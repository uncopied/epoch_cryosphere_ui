import algosdk, { LogicSigAccount, Transaction } from 'algosdk';
import ChainService from './ChainService';
import WalletService from './WalletService';

export default class TransactionService {
  algod = new ChainService().algod;
  walletService = new WalletService();

  collabAddresses = (): string[] => [
    process.env.REACT_APP_COLLAB_1_ADDRESS!,
    process.env.REACT_APP_COLLAB_2_ADDRESS!,
    process.env.REACT_APP_COLLAB_3_ADDRESS!,
    process.env.REACT_APP_COLLAB_4_ADDRESS!,
    process.env.REACT_APP_COLLAB_5_ADDRESS!,
    process.env.REACT_APP_COLLAB_6_ADDRESS!,
    process.env.REACT_APP_COLLAB_7_ADDRESS!,
    process.env.REACT_APP_COLLAB_8_ADDRESS!,
  ];

  sendAndConfirm = async (
    signedTxns: Uint8Array[]
  ): Promise<Record<string, any>> => {
    try {
      const sentTxns = await this.algod.sendRawTransaction(signedTxns).do();
      console.log('sentTxns', sentTxns);

      const confirmedTxns = await algosdk.waitForConfirmation(
        this.algod,
        sentTxns.txId,
        4
      );
      return confirmedTxns;
    } catch (error) {
      throw error;
    }
  };

  sellAsset = async ({
    seller,
    assetIndex,
    contractResult,
  }: any): Promise<Record<string, any>> => {
    try {
      const contractEncoded = new Uint8Array(
        Buffer.from(contractResult, 'base64')
      );
      const contractSig = new LogicSigAccount(contractEncoded);
      const suggestedParams = await this.algod.getTransactionParams().do();
      // fund escrow
      const txn0: Transaction =
        algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          from: seller,
          to: contractSig.address(),
          amount: 0.5 * 1e6,
          suggestedParams,
        });
      // opt in escrow
      const txn1: Transaction =
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          from: contractSig.address(),
          to: contractSig.address(),
          amount: 0,
          assetIndex,
          suggestedParams,
        });
      // transfer asset to escrow
      const txn2: Transaction =
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          from: seller,
          to: contractSig.address(),
          assetIndex,
          amount: 1,
          suggestedParams,
        });

      const group = algosdk.assignGroupID([txn0, txn1, txn2]);
      const signedTxns = await this.walletService.sign(group);
      console.log(signedTxns)
      console.log(group[1])
      signedTxns[1] = algosdk.signLogicSigTransactionObject(
        group[1],
        contractSig
      ).blob;

      const confirmedTxns = await this.sendAndConfirm(signedTxns);
      return confirmedTxns;
    } catch (error) {
      throw error;
    }
  };

  buyAsset = async ({
    buyer,
    seller,
    assetIndex,
    price,
    contractSig,
  }: any): Promise<Record<string, any>> => {
    try {
      const suggestedParams = await this.algod.getTransactionParams().do();
      const groupTxns = [];
      // pay seller, 25%
      const txn0 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: buyer,
        to: seller,
        amount: price * 0.25,
        suggestedParams,
      });
      // opt in buyer
      const txn1 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: buyer,
        to: buyer,
        amount: 0,
        assetIndex,
        suggestedParams,
      });
      // transfer asset to buyer
      const txn2 = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: contractSig.address(),
        to: buyer,
        amount: 1,
        assetIndex,
        closeRemainderTo: buyer,
        suggestedParams,
      });
      groupTxns.push(txn0, txn1, txn2);
      // pay collaborators 1-7, 60%
      this.collabAddresses().forEach((collabAddress) => {
        const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
          from: buyer,
          to: collabAddress,
          amount: (price * 0.6) / 7,
          suggestedParams,
        });
        groupTxns.push(txn);
      });
      // pay collaborator 8, 15%
      const txn3 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: buyer,
        to: process.env.REACT_APP_COLLAB_1_ADDRESS ?? '',
        amount: price * 0.15,
        suggestedParams,
      });
      // close remainder to seller
      const txn4 = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: contractSig.address(),
        to: seller,
        amount: 0,
        closeRemainderTo: seller,
        suggestedParams,
      });
      groupTxns.push(txn3, txn4);

      const group = algosdk.assignGroupID(groupTxns);
      const signedTxns = await this.walletService.sign(group);

      signedTxns[2] = algosdk.signLogicSigTransactionObject(
        group[2],
        contractSig
      ).blob;
      signedTxns[3] = algosdk.signLogicSigTransactionObject(
        group[3],
        contractSig
      ).blob;
      return await this.sendAndConfirm(signedTxns);
    } catch (error) {
      throw error;
    }
  };
}
