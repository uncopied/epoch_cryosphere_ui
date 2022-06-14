export default class ContractService {
  generateAssetSaleContract = async (
    seller: string,
    asset: number,
    price: number
  ): Promise<any> => {
    try {
      const url = `https://us-central1-${process.env.REACT_APP_FIREBASE_ID}.cloudfunctions.net/asset_sale_contract?seller=${seller}&asset=${asset}&price=${price}`;
      const request = await fetch(url);
      return await request.json();
    } catch (error) {
      throw error;
    }
  };

  getAssetMetadataFromIpfs = async (url: string): Promise<any> => {
    try {
      return fetch(url).then((response) => response?.json());
    } catch (error) {
      throw error;
    }
  };
}
