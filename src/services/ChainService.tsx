import { Algodv2, Indexer } from 'algosdk';
import {
  ALGOD_HOST_MAIN,
  ALGOD_HOST_TEST,
  INDEXER_HOST_MAIN,
  INDEXER_HOST_TEST,
  NodeEnv,
} from '../utils';

export default class ChainService {
  isMainNet: boolean = process.env.NODE_ENV === NodeEnv.Production;
  algodHost: string = this.isMainNet ? ALGOD_HOST_MAIN : ALGOD_HOST_TEST;
  algod: Algodv2 = new Algodv2('', this.algodHost, '');
  indexerHost: string = this.isMainNet ? INDEXER_HOST_MAIN : INDEXER_HOST_TEST;
  indexer: Indexer = new Indexer('', this.indexerHost, '');
}
