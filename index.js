require('dotenv').config()
 
const Web3 = require('web3')
const axios = require('axios')
const fs = require('fs');
const csv = require('csv-parser')
const log = require('ololog').configure({ time: true })
const Arweave = require('arweave');
const fetch = require('node-fetch');
const path = require('path');

const arweave = Arweave.init({
  host: 'arweave.net',// Hostname or IP address for a Arweave host
  port: 443,          // Port
  protocol: 'https',  // Network protocol http or https
  timeout: 20000,     // Network request timeouts in milliseconds
  logging: false,     // Enable network request logging
});

const mainnet = `https://mainnet.infura.io/v3/${process.env.INFURA}`
const web3 = new Web3( new Web3.providers.HttpProvider(mainnet) )

web3.eth.defaultAccount = process.env.WALLET

const getCurrentGasPrices = async () => {
  let response = await axios.get('https://ethgasstation.info/json/ethgasAPI.json')
  let prices = {
    low: response.data.safeLow / 10,
    medium: response.data.average / 10,
    high: response.data.fast / 10,
    super: response.data.fastest / 10
  }
 
  console.log("\r\n")
  log (`Current ETH Gas Prices (in GWEI):`.cyan)
  console.log("\r\n")
  log(`Low: ${prices.low} (transaction completes in < 30 minutes)`.green)
  log(`Standard: ${prices.medium} (transaction completes in < 5 minutes)`.yellow)
  log(`Fast: ${prices.high} (transaction completes in < 2 minutes)`.red)
  log(`Fastest: ${prices.super} (transaction completes in < 1 minutes)`.red)
  console.log("\r\n")
 
  return prices
}

const walk = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var i = 0;
    (function next() {
      var file = list[i++];
      if (!file) return done(null, results);
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            next();
          });
        } else {
          results.push(file);
          next();
        }
      });
    })();
  });
};

walk('./Polymorphs', async (err, results) => {
  console.log(results);
  const assets = {
    Characters: [],
    Traits: {
      Backgrounds: [],
      Eyewear: [],
      Footwear: [],
      Headwear: [],
      Lefthandaccessory: [],
      Righthandaccessory: [],
      Pants: [],
      Torso: []
    }
  };

  let rawdata = await fs.readFileSync('./arweave.json');
  let wallet = JSON.parse(rawdata);

  for (const asset of results) {
    const file = await fs.readFileSync(asset);
    const names = asset.replace('/home/illestrater/Development/polymorphMinter/Polymorphs','').replace(/\s+/g, '').split('/');
    names.shift();

    let transaction = await arweave.createTransaction({ data: file }, wallet);
    transaction.addTag('Content-Type', 'image/png');
  
    await arweave.transactions.sign(transaction, wallet);
  
    let uploader = await arweave.transactions.getUploader(transaction);
  
    while (!uploader.isComplete) {
      await uploader.uploadChunk();
      console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
    }

    if (names[0] === 'Characters') {
      assets[names[0]].push({
        name: names[1],
        permalink: `https://arweave.net/${ transaction.id }`
      })
    } else if (names[0] === 'Traits') {
      assets[names[0]][names[1]].push({
        name: names[2],
        permalink: `https://arweave.net/${ transaction.id }`
      })
    }
  
    console.log('JSON UPDATED', `https://arweave.net/${ transaction.id }`, assets);
  }

  let metadataTx = await arweave.createTransaction({ data: Buffer.from(JSON.stringify(assets)) }, wallet);
  metadataTx.addTag('Content-Type', 'application/json');

  await arweave.transactions.sign(metadataTx, wallet);

  let metadataUploader = await arweave.transactions.getUploader(metadataTx);

  while (!metadataUploader.isComplete) {
    await metadataUploader.uploadChunk();
    console.log(`${metadataUploader.pctComplete}% complete, ${metadataUploader.uploadedChunks}/${metadataUploader.totalChunks}`);
  }

  console.log('FINAL HASH', metadataTx.id);
})

const main = async () => {
  let myBalanceWei = await web3.eth.getBalance(web3.eth.defaultAccount).then(balance => balance)
  let myBalance = await web3.utils.fromWei(myBalanceWei, 'ether');
  const block = await web3.eth.getBlock('latest');

  log(`Your wallet balance is currently ${myBalance} ETH`.green)
  const abiData = await fetch(`https://us-central1-thing-1d2be.cloudfunctions.net/getAbi?version=v1.0.0`)
  const { abi } = await abiData.json();
  const address = '0xf198046ed564a0ce6785eb5f4ce205cb8194efe2';
  const Contract = new web3.eth.Contract(abi, address);
  const tokenMintAddress = '0x7c40c4A5F4d98B4888f7Bf2ED252f46D07d63Cd6';

  let index = 1;
  let mintNewIndex = 38;
  const results = [];

  fs.createReadStream('./images/traits.csv')
  .pipe(csv())
  .on('data', (data) => results.push(data))
  .on('end', async () => {
    for (const token of results) {
      if (index < mintNewIndex) {
        index++
      } else {
        console.log(token);
        const file = await fs.readFileSync(`./images/${ token.FileNameSVG }.svg`);
        let rawdata = await fs.readFileSync('./arweave.json');
        let wallet = JSON.parse(rawdata);
        let transaction = await arweave.createTransaction({ data: file }, wallet);
        transaction.addTag('Content-Type', 'image/svg+xml');
      
        await arweave.transactions.sign(transaction, wallet);
      
        let uploader = await arweave.transactions.getUploader(transaction);

        while (!uploader.isComplete) {
          await uploader.uploadChunk();
          console.log(`${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`);
        }

        const metadata = {
          minter: "0x7c40c4A5F4d98B4888f7Bf2ED252f46D07d63Cd6",
          mintedOn: "2021-02-17T00:00:00.069Z",
          contractAddress: "0xf198046ed564a0ce6785eb5f4ce205cb8194efe2",
          minted: "Minted by illestrater",
          fiatPrice: "$0.69",
          name: `NFU #${ index }`,
          description: `NFU #${ index }`,
          youtube_url: "",
          price: 0,
          ethPrice: "0",
          amountToMint: 1,
          visibility: "safe",
          forSale: false,
          image: `https://arweave.net/${ transaction.id }`,
          attributes: [
            {
              trait_type: 'Gender',
              value: token.Gender
            },
            {
              trait_type: 'Type',
              value: token.Type
            },
            {
              trait_type: 'Mouth',
              value: token.Mouth
            },
            {
              trait_type: 'Eyes',
              value: token.Eyes
            },
            {
              trait_type: 'Ear',
              value: token.Ear
            },
            {
              trait_type: 'Hair',
              value: token.Hair
            },
            {
              trait_type: 'Hair Color',
              value: token.HairColor
            },
            {
              trait_type: 'Accessories',
              value: token.Accessories
            },
          ],
          category: "alJuInV4dezvHTNU8Dp1",
          external_url: `https://universe.xyz/${ index }`,
          type: "ERC721"
        };

        let metadataTx = await arweave.createTransaction({ data: Buffer.from(JSON.stringify(metadata)) }, wallet);
        metadataTx.addTag('Content-Type', 'application/json');

        await arweave.transactions.sign(metadataTx, wallet);

        let metadataUploader = await arweave.transactions.getUploader(metadataTx);

        while (!metadataUploader.isComplete) {
          await metadataUploader.uploadChunk();
          console.log(`${metadataUploader.pctComplete}% complete, ${metadataUploader.uploadedChunks}/${metadataUploader.totalChunks}`);
        }

        console.log(metadataTx.id);

        const batchMint = Contract.methods.batchMint('0x7c40c4A5F4d98B4888f7Bf2ED252f46D07d63Cd6', Number(1), metadataTx.id, Number(0), false)
        const encoded = batchMint.encodeABI();

        let nonce = await web3.eth.getTransactionCount(web3.eth.defaultAccount);

        let gasPrices = await getCurrentGasPrices()

        let details = {
          "to": process.env.DESTINATION_WALLET_ADDRESS,
          "gas": 26520,
          "gasPrice": gasPrices.super * 1000000000, // converts the gwei price to wei
          "chainId": 4 // EIP 155 chainId - mainnet: 1, rinkeby: 4
        }
        log(`The outgoing transaction count for your wallet address is: ${nonce}`.magenta)

        var tx = {
          nonce,
          to: address,
          from: tokenMintAddress,
          gas: 500000,
          gasLimit: block.gasLimit,
          gasPrice: details.gasPrice,
          data: encoded
        }

        await new Promise((resolve, reject) => {
          web3.eth.accounts.signTransaction(tx, process.env.WALLET_PRIVATE_KEY)
            .then(signed => {
              console.log('signed', signed);
              var tran = web3.eth.sendSignedTransaction(signed.rawTransaction);

                tran.on('confirmation', (confirmationNumber, receipt) => {
                  if (confirmationNumber > 1) {
                    tran.off('error');
                    tran.off('receipt');
                    tran.off('transactionHash');
                    tran.off('confirmation');
                    resolve();
                  }
                  console.log('confirmation: ' + confirmationNumber);
                });

                tran.on('transactionHash', hash => {
                  console.log('hash');
                  console.log(hash);
                });

                tran.on('receipt', receipt => {
                  console.log('reciept');
                  console.log(receipt);
                });

                tran.on('error', error => {
                  console.log(error.toString());
                  process.exit();
                  reject();
                });
            });
        });

        index++;
      }
    }
  });
}
 
// main()