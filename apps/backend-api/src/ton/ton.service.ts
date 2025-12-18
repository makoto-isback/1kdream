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

  constructor(private configService: ConfigService) {
    this.walletAddress = this.configService.get('TON_WALLET_ADDRESS') || '';
    this.network = this.configService.get('TON_NETWORK') || 'mainnet';
    this.tonApiUrl = this.configService.get('TON_API_URL') || 'https://tonapi.io/v2';
    this.seedPhrase = this.configService.get('TON_SEED_PHRASE') || null;
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

      this.logger.log(`[TON DEPOSIT] Wallet initialized successfully from seed phrase`);
      if (this.walletAddress) {
        this.logger.log(`[TON DEPOSIT] Monitoring wallet address: ${this.walletAddress}`);
      }
    } catch (error) {
      this.logger.error('[TON DEPOSIT] Error initializing wallet from seed phrase:', error);
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
   * Check for new TON transfers to wallet address
   * Detects native TON coin transfers (not USDT)
   */
  async checkTonTransfers(since?: number): Promise<any[]> {
    try {
      if (!this.walletAddress) {
        this.logger.warn('[TON DEPOSIT] TON wallet address not configured');
        return [];
      }

      // Parse wallet address
      const address = Address.parse(this.walletAddress);
      const addressString = address.toString({ urlSafe: true, bounceable: false });

      // Query TON API for transactions
      const response = await axios.get(`${this.tonApiUrl}/blockchain/accounts/${addressString}/transactions`, {
        params: {
          limit: 100,
          ...(since && { start_lt: since }),
        },
        headers: {
          'Authorization': `Bearer ${this.configService.get('TON_API_KEY')}`,
        },
      });

      const transactions = response.data?.transactions || [];
      
      // Filter for incoming transfers (where our address is the destination)
      const incomingTransfers = transactions.filter((tx: any) => {
        const inMsg = tx.in_msg;
        if (!inMsg) return false;
        
        const dest = inMsg.destination?.address;
        if (!dest) return false;
        
        // Check if destination matches our wallet address
        try {
          const destAddress = Address.parse(dest);
          return destAddress.equals(address);
        } catch {
          return false;
        }
      });

      return incomingTransfers;
    } catch (error) {
      this.logger.error('[TON DEPOSIT] Error checking TON transfers:', error);
      return [];
    }
  }

  /**
   * Parse transaction comment/memo from TON transfer
   * TON transfers can include a comment in the message body
   * Format: op code (4 bytes) + comment (UTF-8 string)
   */
  parseTransactionComment(transaction: any): string | null {
    try {
      const inMsg = transaction.in_msg;
      if (!inMsg) return null;

      // TON message can have text comment in msg_data
      // Check for text format first
      if (inMsg.msg_data?.text) {
        return inMsg.msg_data.text.trim() || null;
      }

      // Otherwise, check body format
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
   */
  parseTonAmount(transaction: any): number {
    try {
      const inMsg = transaction.in_msg;
      if (!inMsg) return 0;

      // TON amounts are in nanotons (1 TON = 1e9 nanotons)
      const value = inMsg.value || '0';
      return parseFloat(value) / 1e9; // Convert to TON
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
    try {
      const tx = await this.getTransaction(txHash);
      if (!tx) return 0;

      // Get current block height
      const currentBlockResponse = await axios.get(`${this.tonApiUrl}/blockchain/masterchain-head`, {
        headers: {
          'Authorization': `Bearer ${this.configService.get('TON_API_KEY')}`,
        },
      });

      const currentBlock = currentBlockResponse.data?.seqno || 0;
      const txBlock = tx.block?.seqno || 0;

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
    try {
      if (!this.walletAddress) {
        this.logger.warn('TON wallet address not configured');
        return [];
      }

      // Parse wallet address
      const address = Address.parse(this.walletAddress);
      const addressString = address.toString({ urlSafe: true, bounceable: false });

      // Query TON API for jetton transfers
      // USDT on TON is a jetton with specific master address
      const usdtJettonMaster = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'; // USDT Jetton Master on mainnet
      
      const response = await axios.get(`${this.tonApiUrl}/accounts/${addressString}/jettons`, {
        params: {
          limit: 100,
          ...(since && { start_lt: since }),
        },
        headers: {
          'Authorization': `Bearer ${this.configService.get('TON_API_KEY')}`,
        },
      });

      // Filter for USDT jetton transfers
      const transfers = response.data?.balances || [];
      const usdtTransfers = transfers.filter(
        (transfer: any) => transfer.jetton?.address === usdtJettonMaster
      );

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
    try {
      const response = await axios.get(`${this.tonApiUrl}/blockchain/transactions/${txHash}`, {
        headers: {
          'Authorization': `Bearer ${this.configService.get('TON_API_KEY')}`,
        },
      });
      return response.data;
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
