export enum Chain {
  MainNet = 'mainnet',
  TestNet = 'testnet',
}

export enum Status {
  Pending = 'pending',
  Active = 'active',
  Complete = 'complete',
}

export enum FirebaseFields {
  Seller = 'seller',
  AssetIndex = 'asset_index',
  Price = 'price',
  ContractResult = 'contract_result',
  Status = 'status',
  IsMain = 'is_main',
  CreatedOn = 'created_on',
  UpdatedOn = 'updated_on',
}

export enum FirebaseCollections {
  AssetSaleContracts = 'asset_sale_contracts',
}

export enum NodeEnv {
  Production = 'production',
}
