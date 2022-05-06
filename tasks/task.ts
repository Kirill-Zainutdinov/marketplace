import { MyMarketplace__factory, MyERC721__factory, MyERC1155__factory } from "../typechain";
import { task } from "hardhat/config";
import '@nomiclabs/hardhat-ethers'

// функция createItem721 для ERC721
task("createItem721", "mint NFT token")
    .addParam("to")
    .addParam("uri")
    .setAction(async (args, hre) => {
        // подключаемся к контрактам
        const MARKETPLACEFactory = (await hre.ethers.getContractFactory("MyMarketplace")) as MyMarketplace__factory;
        const marketplace = await MARKETPLACEFactory.attach("0xE90B6e7C7b95A8A46d71d702a876A474fF673d4b");
        const ERC721Factory = (await hre.ethers.getContractFactory("MyERC721")) as MyERC721__factory;
        const erc721 = await ERC721Factory.attach("0x9d9F1b4Eb7Fee65b970C16A0b6BE03c599c3b607");

        // сохраняем баланс до createItem721()
        const balanceBefore = await erc721.balanceOf(args.to);

        // вызываем функцию на контракте
        const tx = await marketplace.createItem721(args.to, args.uri);
        await tx.wait();

        // сохраняем баланс после отправки
        const balanceAfter = await erc721.balanceOf(args.to);

        console.log("The sending of the funds was successful.")
        console.log(`The balance of the ${args.to} address has changed from ${balanceBefore} to ${balanceAfter}`)
});

// функция createItem1155 для ERC155
task("createItem1155", "mint NFT token")
    .addParam("to")
    .addParam("tokenId")
    .addParam("amount")
    .addParam("uri")
    .setAction(async (args, hre) => {
        // подключаемся к контрактам
        const MARKETPLACEFactory = (await hre.ethers.getContractFactory("MyMarketplace")) as MyMarketplace__factory;
        const marketplace = await MARKETPLACEFactory.attach("0xE90B6e7C7b95A8A46d71d702a876A474fF673d4b");
        const MyERC1155Factory = (await hre.ethers.getContractFactory("MyERC1155")) as MyERC1155__factory;
        const erc1155 = await MyERC1155Factory.attach("0xC25c7fca8259D3E0CE5283Cae7D6B0131038B2Db");

        // сохраняем баланс до mint
        const balanceBefore = await erc1155.balanceOf(args.to, args.tokenId);

        // вызываем функцию на контракте
        const tx = await marketplace.createItem1155(args.to, args.tokenId, args.amount, args.uri);
        await tx.wait();

        // сохраняем баланс после отправки
        const balanceAfter = await erc1155.balanceOf(args.to, args.tokenId);

        console.log("The sending of the funds was successful.")
        console.log(`The balance of the ${args.to} address has changed from ${balanceBefore} to ${balanceAfter}`)
});
