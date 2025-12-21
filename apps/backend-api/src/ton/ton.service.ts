import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Address, beginCell, Cell, internal, toNano } from '@ton/core';
import { mnemonicToPrivateKey, KeyPair } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import axios from 'axios';

@Injectable()
export class TonService implements OnModuleInit {
  private readonly logger = new Logger(TonService.name);
  private walletAddress: string;
  private network: string;
  private tonApiUrl: string;
  private seedPhrase: string | null = null;
  private derivedWalletAddress: string | null = null;
  private keyPair: KeyPair | null = null; // Store keypair for signing transactions
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
      
      // Store keypair for signing transactions
      this.keyPair = keyPair;
      
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

      // Log the address being queried for debugging
      console.log('[TON DEBUG] Querying address:', addressString);
      console.log('[TON DEBUG] API URL:', this.tonApiUrl);
      console.log('[TON DEBUG] Has API key:', !!this.tonApiKey);

      // Determine API version from URL
      const isV3 = this.tonApiUrl.includes('/v3') || this.tonApiUrl.endsWith('/api/v3');
      const isV2 = this.tonApiUrl.includes('/v2') || this.tonApiUrl.endsWith('/api/v2');
      
      let transactions: any[] = [];
      
      if (isV3) {
        // TON Center API v3: Use /messages endpoint with destination parameter
        // This returns incoming messages (deposits) to our address
        console.log('[TON DEBUG] Using API v3 /messages endpoint');
        const response = await axios.get(`${this.tonApiUrl}/messages`, {
          params: {
            destination: addressString,
            limit: 50,
            direction: 'in', // Only incoming messages (deposits)
          },
          headers: this.getTonApiHeaders(),
        });
        
        // v3 returns { messages: [...], address_book: {...} }
        const messages = response.data?.messages || [];
        console.log('[TON DEBUG] messages fetched (v3):', messages.length);
        
        if (messages.length === 0) {
          console.log('[TON DEBUG] Raw v3 response:', JSON.stringify(response.data).substring(0, 500));
        }
        
        // Convert v3 message format to our transaction format
        transactions = messages.map((msg: any) => ({
          hash: msg.in_msg_tx_hash || msg.hash,
          in_msg: {
            value: msg.value,
            source: msg.source,
            destination: msg.destination, // Add destination for filtering
            message: msg.message_content?.decoded?.comment || null,
            msg_data: {
              text: msg.message_content?.decoded?.comment || null,
              body: msg.message_content?.body || null,
            },
          },
          utime: parseInt(msg.created_at) || 0,
        }));
      } else {
        // TON Center API v2: Use /getTransactions endpoint
        // Construct v2 URL properly
        const v2BaseUrl = this.tonApiUrl.replace('/v3', '/v2').replace(/\/api\/v3$/, '/api/v2');
        console.log('[TON DEBUG] Using API v2 /getTransactions endpoint');
        console.log('[TON DEBUG] v2 URL:', `${v2BaseUrl}/getTransactions`);
        
        const response = await axios.get(`${v2BaseUrl}/getTransactions`, {
          params: {
            address: addressString,
            limit: 20,
          },
          headers: this.getTonApiHeaders(),
        });
        
        // v2 returns { ok: true, result: [...] }
        transactions = response.data?.result || [];
        console.log('[TON DEBUG] transactions fetched (v2):', transactions.length);
        
        if (transactions.length === 0) {
          console.log('[TON DEBUG] Raw v2 response:', JSON.stringify(response.data).substring(0, 500));
        }
      }
      
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
        
        // Try decoding body if available (BOC encoded cell)
        if (!comment && inMsg.msg_data?.body) {
          try {
            const msgBody = inMsg.msg_data.body;
            
            if (typeof msgBody === 'string' && msgBody.length > 0) {
              // Try to parse as BOC (Cell) first - this is what frontend sends
              try {
                const cell = Cell.fromBase64(msgBody);
                const slice = cell.beginParse();
                
                // Text comments have opcode 0 (32 bits) followed by text
                const opcode = slice.loadUint(32);
                if (opcode === 0) {
                  // Load remaining bits as string
                  comment = slice.loadStringTail();
                  if (comment) {
                    console.log(`[TON DEBUG] Decoded BOC comment: ${comment}`);
                  }
                }
              } catch (bocError) {
                // Not a valid BOC, try raw decoding
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
        // For v3 API, we already filtered by destination in the query, so all messages are to our address
        // For v2 API, we need to check the destination
        const dest = inMsg.destination?.address || inMsg.destination;
        if (isV3) {
          // v3: All messages are already filtered to our address by the API query
          // Just verify value > 0 (actual deposit, not zero-amount message)
          if (tonValue > 0) {
            processedTransactions.push(tx);
            console.log(`[TON DEBUG] Added v3 transaction to processed list: ${txHash}`);
          }
        } else {
          // v2: Need to check destination matches our address
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
      }

      console.log(`[TON DEBUG] Returning ${processedTransactions.length} processed transactions`);
      return processedTransactions;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const url = error.config?.url || 'unknown';
        
        if (status === 404) {
          this.logger.error(`[TON DEPOSIT] 404 Not Found: ${url}`);
          this.logger.error(`[TON DEPOSIT] Check TON_API_URL and endpoint path. Current URL: ${this.tonApiUrl}`);
        } else {
          this.logger.error(`[TON DEPOSIT] API error (${status} ${statusText}): ${url}`);
          this.logger.error('[TON DEPOSIT] API response data:', error.response.data);
        }
      } else {
        this.logger.error('[TON DEPOSIT] Error checking TON transfers:', error.message || error);
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
   * Uses time-based estimation: TON blocks are ~5 seconds
   * 10 confirmations ≈ 50 seconds
   * 
   * @param txHash Transaction hash (for logging)
   * @param utime Transaction Unix timestamp (from v3 API created_at field)
   */
  async getTransactionConfirmations(txHash: string, utime?: number): Promise<number> {
    // Guard: Skip if TON deposits are disabled
    const tonDepositsEnabled = this.configService.get('TON_ENABLE_DEPOSITS') === 'true';
    if (!tonDepositsEnabled) {
      this.logger.debug('[TON DEPOSIT] TON API calls disabled (TON_ENABLE_DEPOSITS !== true). Skipping getTransactionConfirmations().');
      return 0;
    }

    try {
      // If we have the transaction timestamp, use time-based confirmation
      // TON blocks are generated approximately every 5 seconds
      // So 1 confirmation ≈ 5 seconds elapsed
      const SECONDS_PER_BLOCK = 5;
      
      if (utime && utime > 0) {
        const now = Math.floor(Date.now() / 1000);
        const ageSeconds = now - utime;
        const estimatedConfirmations = Math.floor(ageSeconds / SECONDS_PER_BLOCK);
        
        this.logger.debug(
          `[TON DEPOSIT] Time-based confirmations for ${txHash}: age=${ageSeconds}s, est=${estimatedConfirmations} blocks`
        );
        
        return Math.max(0, estimatedConfirmations);
      }
      
      // Fallback: try to get from API (may not work with v3)
      const tx = await this.getTransaction(txHash);
      if (!tx) {
        this.logger.debug(`[TON DEPOSIT] Could not fetch transaction ${txHash} for confirmation check`);
        return 0;
      }

      // Check if tx has utime
      const txUtime = tx.utime || tx.now || tx.created_at;
      if (txUtime && txUtime > 0) {
        const now = Math.floor(Date.now() / 1000);
        const ageSeconds = now - txUtime;
        return Math.max(0, Math.floor(ageSeconds / SECONDS_PER_BLOCK));
      }

      // Last resort: assume transaction is old enough
      this.logger.warn(`[TON DEPOSIT] No timestamp found for ${txHash}, assuming confirmed`);
      return 100; // High number to pass confirmation check
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
      // v3 endpoint: GET /jetton/transfers
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
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const url = error.config?.url || 'unknown';
        
        if (status === 404) {
          this.logger.error(`[USDT] 404 Not Found: ${url}`);
          this.logger.error(`[USDT] Check TON_API_URL and endpoint path. Current URL: ${this.tonApiUrl}`);
        } else {
          this.logger.error(`[USDT] API error (${status} ${statusText}): ${url}`);
          this.logger.error('[USDT] API response data:', error.response.data);
        }
      } else {
        this.logger.error('[USDT] Error checking USDT transfers:', error.message || error);
      }
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
      // v3 endpoint: GET /transactions with hash filter
      // Note: v3 may require address + hash, or use different endpoint
      // For now, try to get from transactions endpoint with hash
      const response = await axios.get(`${this.tonApiUrl}/transactions`, {
        params: {
          hash: txHash,
        },
        headers: this.getTonApiHeaders(),
      });
      // TON Center API v3 wraps result in result field
      const transactions = response.data?.result || [];
      // If multiple results, find the one matching hash
      if (transactions.length > 0) {
        return transactions.find((tx: any) => 
          tx.hash === txHash || tx.transaction_id === txHash || tx.tx_hash === txHash
        ) || transactions[0];
      }
      return null;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const url = error.config?.url || 'unknown';
        
        if (status === 404) {
          this.logger.error(`[TON API] 404 Not Found: ${url} (txHash: ${txHash})`);
          this.logger.error(`[TON API] Check TON_API_URL and endpoint path. Current URL: ${this.tonApiUrl}`);
        } else {
          this.logger.error(`[TON API] API error (${status} ${statusText}): ${url}`);
        }
      } else {
        this.logger.error(`[TON API] Error getting transaction ${txHash}:`, error.message || error);
      }
      return null;
    }
  }

  /**
   * Send USDT via Jetton transfer
   * Implements actual on-chain USDT jetton transfer
   */
  async sendUsdt(toAddress: string, amount: number): Promise<string> {
    if (!this.keyPair) {
      throw new Error('Wallet not initialized - keypair not available');
    }

    if (!this.walletAddress) {
      throw new Error('Platform wallet address not configured');
    }

    try {
      const USDT_JETTON_MASTER = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs'; // USDT Jetton Master on mainnet
      const USDT_DECIMALS = 6; // USDT uses 6 decimals

      // Parse addresses
      const platformAddress = Address.parse(this.walletAddress);
      const recipientAddress = Address.parse(toAddress);
      const jettonMasterAddress = Address.parse(USDT_JETTON_MASTER);

      // Get platform wallet contract
      const wallet = WalletContractV4.create({ workchain: 0, publicKey: this.keyPair.publicKey });
      const walletAddress = wallet.address;

      // Verify wallet address matches configured address
      if (!walletAddress.equals(platformAddress)) {
        this.logger.warn(
          `[USDT WITHDRAWAL] Wallet address mismatch: derived ${walletAddress.toString()} vs configured ${platformAddress.toString()}`,
        );
      }

      // Get jetton wallet address (platform wallet's USDT jetton wallet)
      const jettonWalletAddress = await this.getJettonWalletAddress(platformAddress, jettonMasterAddress);

      // Convert USDT amount to nano-jettons (6 decimals)
      const nanoJettons = BigInt(Math.floor(amount * 1e6));

      // Create jetton transfer message
      const transferMessage = this.createJettonTransferMessage(
        recipientAddress,
        nanoJettons,
        platformAddress, // Response destination (platform wallet)
      );

      // Create internal message to jetton wallet
      const internalMessage = internal({
        to: jettonWalletAddress,
        value: toNano('0.1'), // 0.1 TON for gas
        body: transferMessage,
      });

      // Get wallet seqno
      const seqno = await this.getWalletSeqno(walletAddress);

      // Create transfer from wallet
      const transfer = wallet.createTransfer({
        seqno,
        secretKey: this.keyPair.secretKey,
        messages: [internalMessage],
      });

      // Send transaction
      const txHash = await this.sendTransaction(transfer);

      this.logger.log(
        `[USDT WITHDRAWAL] Sent ${amount} USDT to ${toAddress}. Transaction: ${txHash}`,
      );

      return txHash;
    } catch (error) {
      this.logger.error(`[USDT WITHDRAWAL] Error sending USDT:`, error);
      throw error;
    }
  }

  /**
   * Get jetton wallet address for a given wallet and jetton master
   */
  private async getJettonWalletAddress(
    walletAddress: Address,
    jettonMasterAddress: Address,
  ): Promise<Address> {
    try {
      // Query jetton wallet address from jetton master
      // TON Center API v3: GET /jetton/wallet?address=<wallet>&jetton=<master>
      const response = await axios.get(`${this.tonApiUrl}/jetton/wallet`, {
        params: {
          address: walletAddress.toString({ urlSafe: true, bounceable: false }),
          jetton: jettonMasterAddress.toString({ urlSafe: true, bounceable: false }),
        },
        headers: this.getTonApiHeaders(),
      });

      const jettonWalletAddressStr = response.data?.result?.address;
      if (!jettonWalletAddressStr) {
        throw new Error('Failed to get jetton wallet address from API');
      }

      return Address.parse(jettonWalletAddressStr);
    } catch (error) {
      this.logger.error('[USDT WITHDRAWAL] Error getting jetton wallet address:', error);
      throw error;
    }
  }

  /**
   * Create jetton transfer message
   */
  private createJettonTransferMessage(
    destination: Address,
    amount: bigint,
    responseDestination: Address,
  ): Cell {
    // Jetton transfer op code: 0xf8a7ea5
    const OP_JETTON_TRANSFER = 0xf8a7ea5;
    const queryId = BigInt(Date.now()); // Use timestamp as queryId

    return beginCell()
      .storeUint(OP_JETTON_TRANSFER, 32) // op code
      .storeUint(queryId, 64) // queryId
      .storeCoins(amount) // jetton amount
      .storeAddress(destination) // destination address
      .storeAddress(responseDestination) // response destination (for notifications)
      .storeBit(0) // forward_payload (empty)
      .storeCoins(0) // forward_ton_amount (0)
      .endCell();
  }

  /**
   * Get wallet sequence number
   */
  private async getWalletSeqno(walletAddress: Address): Promise<number> {
    try {
      // TON Center API v3: GET /accounts/{address}
      const addressString = walletAddress.toString({ urlSafe: true, bounceable: false });
      const response = await axios.get(`${this.tonApiUrl}/accounts/${addressString}`, {
        headers: this.getTonApiHeaders(),
      });

      return response.data?.result?.seqno || response.data?.seqno || 0;
    } catch (error) {
      this.logger.error('[USDT WITHDRAWAL] Error getting wallet seqno:', error);
      return 0; // Default to 0 if API fails
    }
  }

  /**
   * Send transaction to TON network
   */
  private async sendTransaction(transfer: Cell): Promise<string> {
    try {
      // Send transaction via TON Center API v3
      // POST /sendBoc
      const boc = transfer.toBoc().toString('base64');

      const response = await axios.post(
        `${this.tonApiUrl}/sendBoc`,
        { boc },
        {
          headers: {
            ...this.getTonApiHeaders(),
            'Content-Type': 'application/json',
          },
        },
      );

      const txHash = response.data?.result || response.data?.hash;
      if (!txHash) {
        throw new Error('No transaction hash in response');
      }

      return txHash;
    } catch (error) {
      this.logger.error('[USDT WITHDRAWAL] Error sending transaction:', error);
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
