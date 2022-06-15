import WalletConnect from '@walletconnect/client';
import { IInternalEvent } from '@walletconnect/types';
import { LogicSigAccount } from 'algosdk';
import { serverTimestamp } from 'firebase/firestore';
import React, { ChangeEvent } from 'react';
import './App.css';
import ChainService from './services/ChainService';
import ContractService from './services/ContractService';
import FirebaseService from './services/FirebaseService';
import TransactionService from './services/TransactionService';
import WalletService from './services/WalletService';
import {
  DEFAULT_PRICE,
  ellipseAddress,
  FirebaseCollections,
  FirebaseFields,
  SButton,
  Status,
  TOTAL_COUNT,
} from './utils';

interface AppProps {}

interface AppState {
  connector: WalletConnect;
  firebaseService: FirebaseService;
  chainService: ChainService;
  contractService: ContractService;
  transactionService: TransactionService;
  address: string;
  connected: boolean;
  accounts: string[];
  contracts: any[];
  // for putting on sale
  price: number;
  assetIndex: number;
}

const INITIAL_STATE: AppState = {
  connector: new WalletService().connector,
  firebaseService: new FirebaseService(),
  chainService: new ChainService(),
  contractService: new ContractService(),
  transactionService: new TransactionService(),
  address: '',
  connected: false,
  accounts: [],
  contracts: [],
  price: -1,
  assetIndex: 0,
};

class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    const { connected, accounts } = INITIAL_STATE.connector;
    this.state = {
      ...INITIAL_STATE,
      connected,
      accounts,
      address: accounts[0],
    };
    this.subscribeToWalletEvents();
    this.setupFirebase();
    console.log('on mainnet:', this.state.chainService.isMainNet);
  }

  setupFirebase = async () => {
    await this.state.firebaseService.setup();
    this.loadContracts();
  };

  subscribeToWalletEvents = async () => {
    const connector = this.state.connector;
    if (!connector) return;
    connector.on('connect', (error: Error | null, payload: any) => {
      window.location.reload();
      console.log(`connector.on('connect')`);
      if (error) throw error;
      this.onConnect(payload);
    });
    connector.on(
      'session_update',
      async (error: Error | null, payload: any) => {
        console.log(`connector.on('session_update')`);
        if (error) throw error;
        const accounts = payload.params[0].accounts;
        this.onSessionUpdate(accounts);
      }
    );
    connector.on('disconnect', (error: Error | null, payload: any) => {
      console.log(`connector.on('disconnect')`);
      if (error) throw error;
      this.onDisconnect();
    });
    if (connector.connected) {
      const { accounts } = connector;
      this.setState({
        connected: true,
        accounts,
        address: accounts[0],
      });
      this.onSessionUpdate(accounts);
    }
    this.setState({ connector });
  };

  onConnect = (payload: IInternalEvent) => {
    const { accounts } = payload.params[0];
    this.setState({
      connected: true,
      accounts,
      address: accounts[0],
    });
  };

  onSessionUpdate = (accounts: string[]) => {
    this.setState({ accounts, address: accounts[0] });
  };

  onDisconnect = () => {
    this.setState({ ...INITIAL_STATE });
  };

  killSession = () => {
    const { connector } = this.state;
    if (connector) connector.killSession();
    this.setState({ ...INITIAL_STATE });
  };

  // asset management
  loadContracts = async () => {
    const contracts: any[] = [];
    await this.state.firebaseService
      .getDocuments(FirebaseCollections.AssetSaleContracts)
      .then((snapshot) =>
        snapshot.forEach((contract) => {
          const contractData = contract.data();
          if (
            contractData[FirebaseFields.Seller] === this.state.address &&
            contractData[FirebaseFields.Status] === Status.Active &&
            contractData[FirebaseFields.IsMain] ===
              this.state.chainService.isMainNet
          ) {
            contracts.push(contract.data());
          }
        })
      );
    this.setState({ contracts });
  };

  sellAsset = async (): Promise<void> => {
    const {
      address: seller,
      firebaseService,
      chainService,
      contractService,
      transactionService,
      assetIndex,
      price,
    } = this.state;

    if (seller && price) {
      try {
        const contract = await contractService.generateAssetSaleContract(
          seller,
          assetIndex,
          price
        );
        const contractResult = contract.result;
        const response = await firebaseService.addDocument(
          FirebaseCollections.AssetSaleContracts,
          {
            seller,
            asset_index: assetIndex,
            price,
            contract_result: contractResult,
            status: Status.Pending,
            is_main: chainService.isMainNet,
            created_on: serverTimestamp(),
          }
        );
        // confirm transaction
        await transactionService.sellAsset({
          seller,
          assetIndex,
          contractResult,
        });
        console.log(response);
        // update status to active
        firebaseService.updateDocument(
          FirebaseCollections.AssetSaleContracts,
          response.id,
          {
            status: Status.Active,
            updated_on: serverTimestamp(),
          }
        );
        // this.setState({ status: Status.Active, price });
      } catch (error) {
        throw error;
      }
    }
  };

  buyAsset = async (): Promise<void> => {
    const {
      connector,
      address: buyer,
      contracts,
      transactionService,
      firebaseService,
    } = this.state;

    if (!buyer) {
      connector.createSession();
      return;
    }

    const currContract = contracts[0];
    const contractSig = await this.getContractSig(currContract);
    const seller = currContract[FirebaseFields.Seller];
    const price = currContract[FirebaseFields.Price];
    const assetIndex = currContract[FirebaseFields.AssetIndex];

    if (contractSig && seller && price) {
      try {
        // confirm transaction
        await transactionService.buyAsset({
          buyer,
          seller,
          assetIndex,
          price,
          contractSig,
        });
        firebaseService.updateDocument(
          FirebaseCollections.AssetSaleContracts,
          currContract.id,
          {
            status: Status.Complete,
            updated: serverTimestamp(),
            buyer,
          }
        );
        const remainingContracts = contracts.slice(1);
        this.setState({ contracts: remainingContracts });
        alert('Congratulations on acquiring a CRYOSPHERE NFT!');
      } catch (error) {
        alert(
          'Apologies, transaction cancelled. Please refresh the page and try again.'
        );
        throw error;
      }
    }
  };

  getContractSig = async (contractData: any): Promise<LogicSigAccount> => {
    const contractResult = contractData[FirebaseFields.ContractResult];
    const contract = new Uint8Array(Buffer.from(contractResult, 'base64'));
    return new LogicSigAccount(contract);
  };

  editionDisplay = (): string => {
    const count = TOTAL_COUNT - this.state.contracts.length;
    return `${count}/${TOTAL_COUNT} edition`;
  };

  onPriceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const price: number = parseInt(event.target.value) * 1e6 ?? DEFAULT_PRICE;
    this.setState({ price });
  };

  onAssetIndexChange = (event: ChangeEvent<HTMLInputElement>) => {
    const assetIndex: number = parseInt(event.target.value);
    this.setState({ assetIndex });
  };

  render() {
    const { connector, address, contracts } = this.state;
    const connectWallet = async () => connector.createSession();
    const handleBuy = async () => this.buyAsset();
    const handleSell = async () => this.sellAsset();
    const seller = contracts?.length
      ? contracts[0][FirebaseFields.Seller]
      : null;

    return (
      <div className='vh-100 flex items-center justify-around'>
        {address ? (
          <div className='w-100 flex items-start justify-around'>
            <div className='flex flex-column'>
              <SButton onClick={this.killSession}>Disconnect</SButton>
              <span className='blue mt1'>{ellipseAddress(address)}</span>
            </div>
            <SButton onClick={handleBuy} disabled={seller === address}>
              Acquire NFT
            </SButton>
            {/* <div>{contracts.length} / 250 edition</div> */}
            <div>{this.editionDisplay()}</div>

            <div className='flex flex-column items-center justify-between'>
              <SButton className='w-third pointer' onClick={handleSell}>
                Put on Sale
              </SButton>
              <div className='flex mt1'>
                <input
                  className='pa2 ba br2 mr2'
                  type='number'
                  min='1'
                  step='1'
                  name='assetIndex'
                  onChange={this.onAssetIndexChange}
                  required
                  placeholder='Asset Index'
                />
                <input
                  className='pa2 ba br2'
                  type='number'
                  min='1'
                  step='1'
                  name='price'
                  onChange={this.onPriceChange}
                  required
                  placeholder='Price in Algo'
                />
              </div>
            </div>
          </div>
        ) : (
          <SButton onClick={connectWallet}>Connect Algorand Wallet</SButton>
        )}
      </div>
    );
  }
}

export default App;
