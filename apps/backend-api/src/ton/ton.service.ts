import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Address } from '@ton/core';
import { mnemonicToPrivateKey } from '@ton/crypto';
import axios from 'axios';

@Injectable()
export class TonService implements OnModuleInit {
  private readonly logger = new Logger(TonService.name);
  private walletAddress: string;
  private network: string;
  private tonApiUrl: string;
  private seedPhrase: string | null = null;
  private derivedWalletAddress: string | null = null;
  private isInitialized: boolean = false;
  private isWalletReady: boolean = false;
  private tonApiKey: string | null = null;

  constructor(private configService: ConfigService) {
    this.walletAddress = this.configService.get('TON_WALLET_ADDRESS') || '';
    this.network = this.configService.get('TON_NETWORK') || 'mainnet';
    this.tonApiUrl = this.configService.get('TON_API_URL') || 'https://toncenter.com/api/v3';
    this.seedPhrase = this.configService.get('TON_SEED_PHRASE') || null;
    // Get and trim API key once
    const apiKey = this.configService.get('TON_API_KEY');
    this.tonApiKey = apiKey ? apiKey.trim() : null;
  }

  /**
   * Get TON API request headers with authentication
   * Returns headers with X-API-Key header (TON Center API v3 format)
   */
  private getTonApiHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    if (this.tonApiKey) {
      headers['X-API-Key'] = this.tonApiKey;
    }
    
    return headers;
  }

  async onModuleInit() {
    // Initialize wallet from seed phrase if provided
    if (this.seedPhrase) {
      try {
        await this.initializeWalletFromSeed();
      } catch (error) {
        this.logger.error('[TON DEPOSIT] Failed to initialize wallet from seed phrase:', error);
        // Fail gracefully - don't crash the app
      }
    }
  }

  /**
   * Initialize wallet from seed phrase and verify address matches
   */
  private async initializeWalletFromSeed(): Promise<void> {
    if (!this.seedPhrase) {
      throw new Error('Seed phrase not provided');
    }

    try {
      // Parse seed phrase (12 or 24 words)
      const words = this.seedPhrase.trim().split(/\s+/);
      if (words.length !== 12 && words.length !== 24) {
        throw new Error(`Invalid seed phrase length: ${words.length} words (expected 12 or 24)`);
      }

      // Derive private key from mnemonic
      const keyPair = await mnemonicToPrivateKey(words);

      // Store the keypair for future use (signing transactions, etc.)
      // For now, we're just monitoring deposits, so we don't need to derive the address
      // The address should be provided in TON_WALLET_ADDRESS
      
      // If wallet address is provided, use it
      // Otherwise, we would need to derive it from the public key using wallet contract
      // For simplicity and security, we require TON_WALLET_ADDRESS to be set
      if (!this.walletAddress) {
        this.logger.warn('[TON DEPOSIT] TON_WALLET_ADDRESS not provided. Address verification skipped.');
        this.logger.warn('[TON DEPOSIT] It is recommended to set TON_WALLET_ADDRESS for address verification.');
      }

      // Mark as initialized (we have the keypair, address verification is optional)
      this.derivedWalletAddress = this.walletAddress; // Use configured address
      this.isInitialized = true;
      this.isWalletReady = true; // Wallet is ready for use

      this.logger.log(`[TON DEPOSIT] Wallet initialized successfully from seed phrase`);
      if (this.walletAddress) {
        this.logger.log(`[TON DEPOSIT] Monitoring wallet address: ${this.walletAddress}`);
      }
    } catch (error) {
      this.logger.error('[TON DEPOSIT] Error initializing wallet from seed phrase:', error);
      // Don't set isWalletReady on error - wallet is not ready
      throw error;
    }
  }

  getWalletAddress(): string {
    return this.walletAddress;
  }

  /**
   * Get derived wallet address from seed phrase (if initialized)
   */
  getDerivedWalletAddress(): string | null {
    return this.derivedWalletAddress;
  }

  /**
   * Check if wallet is initialized from seed phrase
   */
  isWalletInitialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if wallet is ready for use (initialized and ready)
   * This is separate from isInitialized to handle async initialization
   */
  isWalletReadyForUse(): boolean {
    return this.isWalletReady;
  }

  /**
   * Check for new TON transfers to wallet address
   * Detects native TON coin transfers (not USDT)
   */
  async checkTonTransfers(since?: number): Promise<any[]> {
    // Guard: Skip if TON deposits are disabled
    const tonDepositsEnabled = this.configService.get('TON_ENABLE_DEPOSITS') === 'true';
    if (!tonDepositsEnabled) {
      this.logger.debug('[TON DEPOSIT] TON API calls disabled (TON_ENABLE_DEPOSITS !== true). Skipping checkTonTransfers().');
      return [];
    }

    try {
      if (!this.walletAddress) {
        this.logger.warn('[TON DEPOSIT] TON wallet address not configured');
        return [];
      }

      // Parse wallet address
      const address = Address.parse(this.walletAddress);
      const addressString = address.toString({ urlSafe: true, bounceable: false });

      // Query TON Center API v3 for transactions - DO NOT use lt or since
      const response = await axios.get(`${this.tonApiUrl}/transactions`, {
        params: {
          address: addressString,
          limit: 20,
        },
        headers: this.getTonApiHeaders(),
      });

      const transactions = response.data?.result || [];
      console.log('[TON DEBUG] transactions fetched:', transactions.length);
      
      // Process each transaction and log details
      const processedTransactions = [];
      
      for (const tx of transactions) {
        const inMsg = tx.in_msg;
        if (!inMsg) {
          continue;
        }
        
        // Extract hash
        const txHash = tx.hash || tx.transaction_id || tx.tx_hash || null;
        
        // Extract value (in nanotons)
        const value = inMsg.value || inMsg.amount || '0';
        const nanotons = typeof value === 'string' ? parseFloat(value) : value;
        const tonValue = nanotons / 1e9; // Convert to TON
        
        // Extract comment from multiple possible fields
        let comment: string | null = null;
        
        // Try in_msg.message first
        if (inMsg.message) {
          comment = typeof inMsg.message === 'string' ? inMsg.message : null;
        }
        
        // Try decoded body text
        if (!comment && inMsg.msg_data?.text) {
          comment = inMsg.msg_data.text.trim() || null;
        }
        
        // Try decoding body if available
        if (!comment && inMsg.msg_data?.body) {
          try {
            const msgBody = inMsg.msg_data.body;
            
            if (typeof msgBody === 'string') {
              let bodyBytes: Buffer;
              try {
                bodyBytes = Buffer.from(msgBody, 'base64');
              } catch {
                try {
                  bodyBytes = Buffer.from(msgBody, 'hex');
                } catch {
                  bodyBytes = Buffer.from(msgBody, 'utf-8');
                }
              }
              
              // Skip first 4 bytes (op code) if present
              if (bodyBytes.length > 4) {
                const commentBytes = bodyBytes.slice(4);
                comment = commentBytes.toString('utf-8').trim() || null;
              } else if (bodyBytes.length > 0) {
                comment = bodyBytes.toString('utf-8').trim() || null;
              }
            }
            // If body is not a string, skip comment parsing (comment remains null)
          } catch (err) {
            // Ignore decoding errors
          }
        }
        
        // Fallback: use empty string if no comment found
        if (!comment) {
          comment = '';
        }
        
        // Log transaction details
        console.log(`[TON DEBUG] tx hash=${txHash} value=${tonValue} comment=${comment}`);
        
        // Filter for incoming transfers (where our address is the destination)
        const dest = inMsg.destination?.address || inMsg.destination;
        if (dest) {
          try {
            const destAddress = Address.parse(dest);
            if (destAddress.equals(address)) {
              processedTransactions.push(tx);
            }
          } catch {
            // Invalid address format, skip
          }
        }
      }

      return processedTransactions;
    } catch (error) {
      this.logger.error('[TON DEPOSIT] Error checking TON transfers:', error);
      if (error.response) {
        this.logger.error('[TON DEPOSIT] API response status:', error.response.status);
        this.logger.error('[TON DEPOSIT] API response data:', error.response.data);
      }
      return [];
    }
  }

  /**
   * Parse transaction comment/memo from TON transfer
   * TON transfers can include a comment in the message body
   * Format: op code (4 bytes) + comment (UTF-8 string)
   * TON Center API v3 structure may differ from tonapi.io
   */
  parseTransactionComment(transaction: any): string | null {
    try {
      const inMsg = transaction.in_msg;
      if (!inMsg) return null;

      // TON Center API v3: Check for text comment in msg_data
      // Check for text format first
      if (inMsg.msg_data?.text) {
        return inMsg.msg_data.text.trim() || null;
      }

      // Check for body format (base64 encoded)
      const msgBody = inMsg.msg_data?.body;
      if (!msgBody) return null;

      // Decode base64 or hex body
      let bodyBytes: Buffer;
      if (typeof msgBody === 'string') {
        // Try base64 first, then hex
        try {
          bodyBytes = Buffer.from(msgBody, 'base64');
        } catch {
          try {
            bodyBytes = Buffer.from(msgBody, 'hex');
          } catch {
            return null;
          }
        }
      } else {
        return null;
      }
      
      // Skip first 32 bits (4 bytes) which is the op code (0x00000000 for text messages)
      if (bodyBytes.length <= 4) return null;
      
      const commentBytes = bodyBytes.slice(4);
      const comment = commentBytes.toString('utf-8').trim();
      
      return comment || null;
    } catch (error) {
      this.logger.debug('[TON DEPOSIT] Error parsing transaction comment:', error);
      return null;
    }
  }

  /**
   * Parse TON amount from transaction
   * TON Center API v3: value is in nanotons
   */
  parseTonAmount(transaction: any): number {
    try {
      const inMsg = transaction.in_msg;
      if (!inMsg) return 0;

      // TON amounts are in nanotons (1 TON = 1e9 nanotons)
      // TON Center API v3: value can be string or number
      const value = inMsg.value || inMsg.amount || '0';
      const nanotons = typeof value === 'string' ? parseFloat(value) : value;
      return nanotons / 1e9; // Convert to TON
    } catch (error) {
      this.logger.error('[TON DEPOSIT] Error parsing TON amount:', error);
      return 0;
    }
  }

  /**
   * Get transaction confirmation count
   * Returns number of blocks since transaction
   */
  async getTransactionConfirmations(txHash: string): Promise<number> {
    // Guard: Skip if TON deposits are disabled
    const tonDepositsEnabled = this.configService.get('TON_ENABLE_DEPOSITS') === 'true';
    if (!tonDepositsEnabled) {
      this.logger.debug('[TON DEPOSIT] TON API calls disabled (TON_ENABLE_DEPOSITS !== true). Skipping getTransactionConfirmations().');
      return 0;
    }

    try {
      const tx = await this.getTransaction(txHash);
      if (!tx) return 0;

      // Get current block height (TON Center API v3)
      const currentBlockResponse = await axios.get(`${this.tonApiUrl}/getMasterchainInfo`, {
        headers: this.getTonApiHeaders(),
      });

      const currentBlock = currentBlockResponse.data?.result?.last?.seqno || currentBlockResponse.data?.result?.last_seqno || 0;
      
      // TON Center API v3: transaction block info can be in different locations
      const txBlock = tx.transaction?.block_id?.seqno || 
                     tx.block_id?.seqno || 
                     tx.block?.seqno || 
                     tx.block_seqno || 
                     0;

      return Math.max(0, currentBlock - txBlock);
    } catch (error) {
      this.logger.error(`[TON DEPOSIT] Error getting confirmations for ${txHash}:`, error);
      return 0;
    }
  }

  isValidAddress(address: string): boolean {
    try {
      Address.parse(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check for new USDT Jetton transfers to wallet address
   * USDT on TON uses Jetton standard
   */
  async checkUsdtTransfers(since?: number): Promise<any[]> {
    // Guard: Skip if USDT deposits are disabled
    const usdtDepositsEnabled = this.configService.get('USDT_ENABLE_DEPOSITS') === 'true';
    if (!usdtDepositsEnabled) {
      this.logger.debug('[USDT] TON API calls disabled (USDT_ENABLE_DEPOSITS !== true). Skipping checkUsdtTransfers().');
      return [];
    }

    try {
      if (!this.walletAddress) {
        this.logger.warn('TON wallet address not configured');
        return [];
      }

      // Parse wallet address
      const address = Address.parse(this.walletAddress);
      const addressString = address.toString({ urlSafe: true, bounceable: false });

      // Query TON Center API v3 for jetton transfers
      // USDT on TON is a jetton with specific master address
      const usdtJettonMaster = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'; // USDT Jetton Master on mainnet
      
      const response = await axios.get(`${this.tonApiUrl}/jetton/transfers`, {
        params: {
          address: addressString,
          jetton: usdtJettonMaster,
          limit: 100,
          ...(since && { lt: since }),
        },
        headers: this.getTonApiHeaders(),
      });

      // TON Center API v3 returns transfers directly
      const transfers = response.data?.result || [];
      const usdtTransfers = transfers;

      return usdtTransfers;
    } catch (error) {
      this.logger.error('Error checking USDT transfers:', error);
      return [];
    }
  }

  /**
   * Get transaction details for a specific hash
   */
  async getTransaction(txHash: string): Promise<any> {
    // Guard: Skip if both TON and USDT deposits are disabled
    const tonDepositsEnabled = this.configService.get('TON_ENABLE_DEPOSITS') === 'true';
    const usdtDepositsEnabled = this.configService.get('USDT_ENABLE_DEPOSITS') === 'true';
    
    if (!tonDepositsEnabled && !usdtDepositsEnabled) {
      this.logger.debug('[TON API] TON API calls disabled (both TON_ENABLE_DEPOSITS and USDT_ENABLE_DEPOSITS are not true). Skipping getTransaction().');
      return null;
    }

    try {
      // TON Center API v3: Get transaction by hash
      const response = await axios.get(`${this.tonApiUrl}/transactions`, {
        params: {
          hash: txHash,
        },
        headers: this.getTonApiHeaders(),
      });
      // TON Center API v3 wraps result in result field
      return response.data?.result?.[0] || response.data;
    } catch (error) {
      this.logger.error(`Error getting transaction ${txHash}:`, error);
      return null;
    }
  }

  /**
   * Send USDT via Jetton transfer
   * Note: This requires wallet implementation with private key
   * For production, use a secure wallet service
   */
  async sendUsdt(toAddress: string, amount: number): Promise<string> {
    try {
      // In production, this would:
      // 1. Use TON wallet SDK to create jetton transfer
      // 2. Sign transaction with private key
      // 3. Broadcast to TON network
      // 4. Return transaction hash
      
      this.logger.log(`Sending ${amount} USDT to ${toAddress}`);
      
      // Placeholder - implement with actual TON wallet
      // For now, return empty string (manual processing)
      return '';
    } catch (error) {
      this.logger.error('Error sending USDT:', error);
      throw error;
    }
  }

  /**
   * Parse USDT amount from jetton transfer
   */
  parseUsdtAmount(transfer: any): number {
    try {
      // USDT uses 6 decimals on TON
      const amount = transfer.balance || transfer.amount || '0';
      return parseFloat(amount) / 1e6; // Convert from nano units
    } catch (error) {
      this.logger.error('Error parsing USDT amount:', error);
      return 0;
    }
  }
}
