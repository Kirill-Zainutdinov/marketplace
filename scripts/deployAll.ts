import { MyERC20, MyERC721, MyERC1155, MyMarketplace } from "../typechain";
import { ethers } from "hardhat";

async function main() {

    let erc20 : MyERC20;
    let erc721 : MyERC721;
    let erc1155 : MyERC1155;
    let marketplace : MyMarketplace;
    // аргументы для конструкторов контрактов
    const name20 = "KirillZaynutdinovToken";
    const symbol20 = "KZT";
    const decimals = 3;
    const name721 = "HappyRoger721";
    const symbol721 = "HR721";
    const name1155 = "HappyRoger1155";
    const symbol1155 = "HR1155";
    const baseUri = "https://gateway.pinata.cloud/ipfs/QmRLaoJoLxcsEhA3JXs3FeShJJXyAfVTSw7KvrJfV554MA/";
    const [owner] = await ethers.getSigners();
    const tokenId2 = 2

    // деплоим ERC20
    const ERC20Factory = (await ethers.getContractFactory("MyERC20"));
    erc20 = await ERC20Factory.deploy(name20, symbol20, decimals);
    console.log("Token erc20 deployed to:", erc20.address); 

    // деплоим ERC721
    const ERC721Factory = (await ethers.getContractFactory("MyERC721"));
    erc721 = await ERC721Factory.deploy(name721, symbol721);
    console.log("Token erc721 deployed to:", erc721.address); 

    // деплоим ERC1155
    const ERC1155Factory = (await ethers.getContractFactory("MyERC1155"));
    erc1155 = await ERC1155Factory.deploy(name1155, symbol1155);
    console.log("Token erc1155 deployed to:", erc1155.address); 

    // деплоим marketplace
    const MARKETPLACEFactory = (await ethers.getContractFactory("MyMarketplace"));
    marketplace = await MARKETPLACEFactory.deploy(erc20.address, erc721.address, erc1155.address);
    console.log("Marketplace deployed to:", marketplace.address); 

    // выдаём права минтера контракту marketplace для токена 721
    let minter = await erc721.minter();
    let tx = await erc721.grantRole(minter, marketplace.address);
    await tx.wait();
    let role = await erc721.hasRole(minter, marketplace.address)
    console.log("Marketplace minter for ERC721 contract:", role); 

    // выдаём права минтера контракту marketplace для токена 1155
    minter = await erc1155.minter();
    tx = await erc1155.grantRole(minter, marketplace.address);
    await tx.wait();
    role = await erc1155.hasRole(minter, marketplace.address)
    console.log("Marketplace minter for ERC1155 contract:", role);

    // делаем эмиссию 5 новых токенов ERC721
    for(let i = 1; i <= 5; i++){
        let tx  = await marketplace.createItem721(owner.address, baseUri + i.toString());
        await tx.wait();
        console.log(`New ERC721 token create! Token ID: ${i}`);
    }

    // апрувнем два токена ERC721 и выставим их на продажу, потом один снимаем
    for(let i = 1; i <= 2; i++){
        tx = await erc721.approve(marketplace.address, i);
        await tx.wait();
        tx = await marketplace.listItem721(i, 100);
        await tx.wait();
        console.log(`the token ${i} is for sale`);
    }
    
    tx  = await marketplace.cancel721(tokenId2);
    await tx.wait();
    console.log(`token ${tokenId2} withdrawn from sale`);
    
    // выставим токен ERC721 на аукцион
    tx = await erc721.approve(marketplace.address, tokenId2);
    await tx.wait();
    tx = await marketplace.listItemOnAuction721(tokenId2, 100);
    await tx.wait();
    console.log(`the token ${tokenId2} is up for auction`);

    const amount = 5;
    // делаем эмиссию 5 новых токенов ERC1155
    for(let i = 1; i <= 5; i++){
        let tx  = await marketplace.createItem1155(owner.address, i, amount, baseUri + i.toString());
        await tx.wait();
        console.log(`New ERC155 token create! Token ID: ${i}`);
    }

    // апрувнем два токена ERC155 и выставим их на продажу, потом один снимаем
    tx = await erc1155.setApprovalForAll(marketplace.address, true);
    await tx.wait();
    for(let i = 1; i <= 2; i++){
        tx = await marketplace.listItem1155(i, amount, 100);
        await tx.wait();
        console.log(`the token ${i} is for sale`);
    }
    
    tx  = await marketplace.cancel1155(tokenId2);
    await tx.wait();
    console.log(`token ${tokenId2} withdrawn from sale`);
    
    // выставим токен ERC1155 на аукцион
    tx = await marketplace.listItemOnAuction1155(tokenId2, amount, 100);
    await tx.wait();
    
    console.log(`the token ${tokenId2} is up for auction`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
/*
Token erc20 deployed to: 0x52f051165079FFDa3095D2F8f3bf375B7375DD1C
Token erc721 deployed to: 0xE539C3696dd666332BBe13cfB4EB1A79c6c9ae5A
Token erc1155 deployed to: 0x537A1Dd855e358EBE1dE51E8C9c2e7b528e21A61
Marketplace deployed to: 0x3b19E348DB389561BD32c9Bf39B28C7eD42A62b1
Marketplace minter for ERC721 contract: true
Marketplace minter for ERC1155 contract: true
New ERC721 token create! Token ID: 1
New ERC721 token create! Token ID: 2
New ERC721 token create! Token ID: 3
New ERC721 token create! Token ID: 4
New ERC721 token create! Token ID: 5
the token 1 is for sale
the token 2 is for sale
token 2 withdrawn from sale
the token 2 is up for auction
New ERC155 token create! Token ID: 1
New ERC155 token create! Token ID: 2
New ERC155 token create! Token ID: 3
New ERC155 token create! Token ID: 4
New ERC155 token create! Token ID: 5
the token 1 is for sale
the token 2 is for sale
token 2 withdrawn from sale
the token 2 is up for auction
*/

