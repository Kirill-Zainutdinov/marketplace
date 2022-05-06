import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MyERC20, MyERC721, MyERC1155, MyMarketplace, TEST } from "../typechain";

describe("Testing Marketplace",  function () {

    let erc20 : MyERC20;
    let erc721 : MyERC721;
    let erc1155 : MyERC1155;
    let marketplace : MyMarketplace;
    let owner : SignerWithAddress;
    let seller : SignerWithAddress;
    let buyer1 : SignerWithAddress;
    let buyer2 : SignerWithAddress;
    let hacker : SignerWithAddress;
    let zeroAddress : string;
    let uris : Array<string> = [];
    // аргументы для конструкторов контрактов
    const name20 = "KirillZaynutdinovToken";
    const symbol20 = "KZT";
    const decimals = 3;
    const name721 = "HappyRoger721";
    const symbol721 = "HR721";
    const name1155 = "HappyRoger1155";
    const symbol1155 = "HR1155";
    const baseUri = "https://gateway.pinata.cloud/ipfs/QmRLaoJoLxcsEhA3JXs3FeShJJXyAfVTSw7KvrJfV554MA/";

    const [tokenId1, tokenId2, tokenId3, tokenId4, tokenId5] = [1, 2, 3, 4, 5]
    const [auctionId1, auctionId2, auctionId3] = [1, 2, 3];

    before(async function(){
        [owner, seller, buyer1, buyer2, hacker] = await ethers.getSigners();
        zeroAddress = "0x0000000000000000000000000000000000000000";

        for(let i = 1; i < 6; i++){
            uris.push(baseUri + i.toString());
        }

        // деплоим ERC20
        const ERC20Factory = (await ethers.getContractFactory("MyERC20"));
        erc20 = await ERC20Factory.deploy(name20, symbol20, decimals);
        // деплоим ERC721
        const ERC721Factory = (await ethers.getContractFactory("MyERC721"));
        erc721 = await ERC721Factory.deploy(name721, symbol721);
        // деплоим ERC1155
        const ERC1155Factory = (await ethers.getContractFactory("MyERC1155"));
        erc1155 = await ERC1155Factory.deploy(name1155, symbol1155);
        // деплоим marketplace
        const MARKETPLACEFactory = (await ethers.getContractFactory("MyMarketplace"));
        marketplace = await MARKETPLACEFactory.deploy(erc20.address, erc721.address, erc1155.address);
    })

    // выдаём роль minter для ERC721 контракту marketplace
    it("check grantRole() for erc721", async function(){

        let minter = await erc721.minter();
        let tx = await erc721.grantRole(minter, marketplace.address);
        await tx.wait();

        expect(await erc721.hasRole(minter, marketplace.address)).equal(true);
    })

    // выдаём роль minter для ERC1155 контракту marketplace
    it("check grantRole() for erc721", async function(){

        let minter = await erc1155.minter();
        let tx = await erc1155.grantRole(minter, marketplace.address);
        await tx.wait();

        expect(await erc1155.hasRole(minter, marketplace.address)).equal(true);
    })

    // создаём токены erc721 через контракт marketplace
    it("check createItem721()", async function(){

        // баланс seller адреса
        // до вызова createItem721 mint()
        const balanceBefore = await erc721.balanceOf(seller.address);

        // делаем эмиссию 5 новых токенов
        for(let i = 0; i < 5; i++){
            let tx  = await marketplace.connect(seller).createItem721(seller.address, uris[i]);
            await tx.wait();
        }

        // баланс seller адреса
        // до вызова createItem721 mint()
        const balanceAfter = await erc721.balanceOf(seller.address);

        // проверяем результат
        expect(await balanceBefore.add(BigNumber.from(5))).equal(balanceAfter);
        for(let i = 1; i <= 5; i++){
            expect(await erc721.ownerOf(i)).equal(seller.address);
        }
    })

    it("check listItem721()", async function(){

        // убедимся, что токен на продажу может выставлять только его владелец
        await expect(
            marketplace.connect(hacker).listItem721(tokenId1, 100)
        ).to.be.revertedWith("Marketplace: Caller is not are owner token");

        // убедимся, что нельзя выставлять токен на продажу не апрувнв его
        await expect(
            marketplace.connect(seller).listItem721(tokenId1, 100)
        ).to.be.revertedWith("Marketplace: No allowance to send a token");

        // апрувнем два токена и выставим их на продажу
        let tx = await erc721.connect(seller).approve(marketplace.address, tokenId1);
        await tx.wait();
        tx = await marketplace.connect(seller).listItem721(tokenId1, 100);
        await tx.wait();

        tx = await erc721.connect(seller).approve(marketplace.address, tokenId2);
        await tx.wait();
        tx = await marketplace.connect(seller).listItem721(tokenId2, 100);
        await tx.wait();

        // проверим, что токен отправлен на адрес маркетплейса*/
        expect(await erc721.ownerOf(tokenId1)).equal(marketplace.address);
        expect(await erc721.ownerOf(tokenId2)).equal(marketplace.address);
    })

    // выпустим ERC20 токены на счёт buyer1 и купим один ERC721 токен
    it("check buyItem721()", async function () {
    
        let tx  = await erc20.mint(buyer1.address, 2000);
        await tx.wait();
    
        // проверим, что нельзя совершить покупку не апрувнув ERC20 токены
        await expect(
            marketplace.connect(buyer1).buyItem721(tokenId1)
        ).to.be.revertedWith("Marketplace: No allowance to send a token");

        // апрувнем достаточно количество ERC20 и совершим покупку
        tx  = await erc20.connect(buyer1).approve(marketplace.address, 100);
        await tx.wait();
        tx  = await marketplace.connect(buyer1).buyItem721(tokenId1);
        await tx.wait();
        
        // проверим, что всё прошло правильно
        expect(await erc721.ownerOf(tokenId1)).equal(buyer1.address);
        expect(await erc20.balanceOf(seller.address)).equal(100);
    });

    // отменим продажу ещё одного ERC721 токена
    it("check cancel721()", async function () {
    
        // проверим, что только владелец токена может отменить сделку
        await expect(
            marketplace.connect(hacker).cancel721(tokenId2)
        ).to.be.revertedWith("Marketplace: Caller is not are owner token");

        let tx  = await marketplace.connect(seller).cancel721(tokenId2);
        await tx.wait();
        
        // проверим, что токен вернулся на адрес seller
        expect(await erc721.ownerOf(tokenId2)).equal(seller.address);
        
        // проверим, что нельзя отменить продажу токена, который не продаётся
        await expect(
            marketplace.connect(hacker).cancel721(tokenId2)
        ).to.be.revertedWith("Marketplace: No such token for sale");
    });

    // Выставим токены ERC721 на аукцион
    it("check listItemOnAuction721()", async function(){

        // убедимся, что токен на продажу может выставлять только его владелец
        await expect(
            marketplace.connect(hacker).listItemOnAuction721(tokenId2, 100)
        ).to.be.revertedWith("Marketplace: Caller is not are owner token");

        // убедимся, что нельзя выставлять токен на продажу не апрувнв его
        await expect(
            marketplace.connect(seller).listItemOnAuction721(tokenId2, 100)
        ).to.be.revertedWith("Marketplace: No allowance to send a token");

        // апрувнем три токена и выставим их на аукцион

        // ПЕРВЫЙ АУКЦИОН - ТУТ БУДЕТ 3 СТАВВКИ
        let tx = await erc721.connect(seller).approve(marketplace.address, tokenId2);
        await tx.wait();
        tx = await marketplace.connect(seller).listItemOnAuction721(tokenId2, 100);
        await tx.wait();
        // ВТОРОЙ АУКЦИОН - ТУТ БУДЕТ 1 СТАВВКА
        tx = await erc721.connect(seller).approve(marketplace.address, tokenId3);
        await tx.wait();
        tx = await marketplace.connect(seller).listItemOnAuction721(tokenId3, 100);
        await tx.wait();
        // ТРЕТИЙ АУКЦИОН - ТУТ НЕ БУДЕТ СТАВОК
        tx = await erc721.connect(seller).approve(marketplace.address, tokenId4);
        await tx.wait();
        tx = await marketplace.connect(seller).listItemOnAuction721(tokenId4, 100);
        await tx.wait();     

        // проверим, что токен отправлен на адрес маркетплейса*
        expect(await erc721.ownerOf(tokenId2)).equal(marketplace.address);
        expect(await erc721.ownerOf(tokenId3)).equal(marketplace.address);
        expect(await erc721.ownerOf(tokenId4)).equal(marketplace.address);
    })

    // сделаем ставки на один из токенов
    it("check makeBid721()", async function () {
    
        const bid1 = 200;
        const bid2 = 300;
        const bid3 = 400;

        // выпустим ERC20 на адрес buyer2
        let tx  = await erc20.mint(buyer2.address, 2000);
        await tx.wait();

        // проверим, что нельзя совершить ставку ниже текущей ставки
        await expect(
            marketplace.connect(buyer1).makeBid721(auctionId1, 50)
        ).to.be.revertedWith("Marketplace: The current price is higher than the bid");

        // проверим, что нельзя совершить покупку не апрувнув ERC20 токены
        await expect(
            marketplace.connect(buyer1).makeBid721(auctionId1, bid1)
        ).to.be.revertedWith("Marketplace: No allowance to send a token");

        // ПЕРВЫЙ АУКЦИОН - ТУТ БУДЕТ 3 СТАВВКИ

        // сохраним балансы до ставки
        let buyer1BalanceBefore = await erc20.balanceOf(buyer1.address);
        let marketplaceBalanceBefore = await erc20.balanceOf(marketplace.address);

        // апрувнем достаточно количество ERC20 и совершим ставку
        tx  = await erc20.connect(buyer1).approve(marketplace.address, bid1);
        await tx.wait();
        tx  = await marketplace.connect(buyer1).makeBid721(auctionId1, bid1)
        await tx.wait();
        
        // проверим, что всё прошло правильно
        expect(await erc20.balanceOf(buyer1.address)).equal(buyer1BalanceBefore.sub(bid1));
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.add(bid1));

        // сделаем ставку от имени другого покупателя
        let buyer2BalanceBefore = await erc20.balanceOf(buyer2.address);

        tx  = await erc20.connect(buyer2).approve(marketplace.address, bid2);
        await tx.wait();
        tx  = await marketplace.connect(buyer2).makeBid721(auctionId1, bid2)
        await tx.wait();
        
        // проверим, что всё прошло правильно
        expect(await erc20.balanceOf(buyer1.address)).equal(buyer1BalanceBefore);
        expect(await erc20.balanceOf(buyer2.address)).equal(buyer2BalanceBefore.sub(bid2));
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.add(bid2));

        // сделаем ставку от имени другого покупателя (чтобы аукцион состоялся нужно сделать не менее 3 ставок)
        tx  = await erc20.connect(buyer1).approve(marketplace.address, bid3);
        await tx.wait();
        tx  = await marketplace.connect(buyer1).makeBid721(auctionId1, bid3)
        await tx.wait();
        
        // проверим, что всё прошло правильно
        expect(await erc20.balanceOf(buyer1.address)).equal(buyer1BalanceBefore.sub(bid3));
        expect(await erc20.balanceOf(buyer2.address)).equal(buyer2BalanceBefore);
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.add(bid3));

        // ВТОРОЙ АУКЦИОН - ТУТ БУДЕТ 1 СТАВВКА

        // сохраним балансы до ставки
        buyer1BalanceBefore = await erc20.balanceOf(buyer1.address);
        marketplaceBalanceBefore = await erc20.balanceOf(marketplace.address);

        // апрувнем достаточно количество ERC20 и совершим ставку
        tx  = await erc20.connect(buyer1).approve(marketplace.address, bid1);
        await tx.wait();
        tx  = await marketplace.connect(buyer1).makeBid721(auctionId2, bid1)
        await tx.wait();
        
        // проверим, что всё прошло правильно
        expect(await erc20.balanceOf(buyer1.address)).equal(buyer1BalanceBefore.sub(bid1));
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.add(bid1));
    });

    // завершаем аукцион токенов ERC721
    it("check finishAuction721()", async function () {

        const bid1 = 200;
        const bid3 = 400;

        // проверим, что нельзя завершить аукцион, если не прошло 3 дня
        await expect(
            marketplace.connect(buyer1).finishAuction721(auctionId1)
        ).to.be.revertedWith("Marketplace: Auction is not yet over");

        // переводим время на 3 дня вперёд
        await ethers.provider.send('evm_increaseTime', [259200]);

        // проверим, что нельзя сделать ставку, если время аукциона закончилось
        await expect(
            marketplace.connect(buyer1).makeBid721(auctionId1, bid3)
        ).to.be.revertedWith("Marketplace: Auction is over");

        // ЗАВЕРШАЕМ ПЕРВЫЙ АУКЦИОН С 3 СТАВКАМИ
        
        // сохраняем балансы
        let sellerBalanceBefore = await erc20.balanceOf(seller.address);
        let marketplaceBalanceBefore = await erc20.balanceOf(marketplace.address);
        // завершаем аукцион
        let tx  = await marketplace.finishAuction721(auctionId1);
        await tx.wait();

        // проверяем, что всё сработало правильно
        expect(await erc721.ownerOf(tokenId2)).equal(buyer1.address);
        expect(await erc20.balanceOf(seller.address)).equal(sellerBalanceBefore.add(bid3));
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.sub(bid3));

        // ЗАВЕРШАЕМ ВТОРОЙ АУКЦИОН С 1 СТАВКОЙ
        
        // сохраняем балансы
        let buyer1BalanceBefore = await erc20.balanceOf(buyer1.address);
        marketplaceBalanceBefore = await erc20.balanceOf(marketplace.address);

        // завершаем 2 аукцион, в котором была 1 ставка
        tx  = await marketplace.finishAuction721(auctionId2);
        await tx.wait();

        // проверяем, что всё сработало правильно
        expect(await erc721.ownerOf(tokenId3)).equal(seller.address);
        expect(await erc20.balanceOf(buyer1.address)).equal(buyer1BalanceBefore.add(bid1));
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.sub(bid1));

        // ЗАВЕРШАЕМ ТРЕТИЙ АУКЦИОН БЕЗ СТАВОК
        
        // завершаем 3 аукцион, в котором не было ставок
        tx  = await marketplace.finishAuction721(auctionId3);
        await tx.wait();

        // проверяем, что всё сработало правильно
        expect(await erc721.ownerOf(tokenId4)).equal(seller.address);
    });

    // создаём токены erc1155 через контракт marketplace
    it("check createItem1155()", async function(){

        let amount = BigNumber.from(5);
        let balancesBefore : Array<BigNumber> = [];
        // баланс seller адреса
        // до вызова createItem1155()
        for(let id = 1; id <= 5; id++){
            balancesBefore.push(await erc1155.balanceOf(seller.address, id));
        }

        // делаем эмиссию 5 новых токенов
        for(let id = 1; id <= 5; id++){
            let tx  = await marketplace.connect(seller).createItem1155(seller.address, id, amount, uris[id - 1]);
            await tx.wait();
        }

        // проверяем результат
        for(let id = 1; id <= 5; id++){
            expect(await erc1155.balanceOf(seller.address, id)).equal(balancesBefore[id - 1].add(amount));
        }
    })

    it("check listItem1155()", async function(){

        const amount = 5;
        // убедимся, что нельзя выставить на продажу токены, которых у вас нет
        await expect(
            marketplace.connect(hacker).listItem1155(tokenId1, amount, 100)
        ).to.be.revertedWith("Marketplace: Caller does not have as many tokens");

        // убедимся, что нельзя выставлять токен на продажу не апрувнв его
        await expect(
            marketplace.connect(seller).listItem1155(tokenId1, amount, 100)
        ).to.be.revertedWith("Marketplace: No allowance to send a token");

        // апрувнем два токена и выставим их на продажу
        let tx = await erc1155.connect(seller).setApprovalForAll(marketplace.address, true);
        await tx.wait();
        tx = await marketplace.connect(seller).listItem1155(tokenId1, amount, 100);
        await tx.wait();
        tx = await marketplace.connect(seller).listItem1155(tokenId2, amount, 100);
        await tx.wait();

        // проверим, что токен отправлен на адрес маркетплейса*/
        expect(await erc1155.balanceOf(marketplace.address, tokenId1)).equal(amount);
        expect(await erc1155.balanceOf(marketplace.address, tokenId2)).equal(amount);
    })

    // buyer1 покупает одну позицию ERC1155 токенов
    it("check buyItem1155()", async function () {
    
        const amount = 5;
        const cost = 100;

        // проверим, что нельзя совершить покупку не апрувнув ERC20 токены
        await expect(
            marketplace.connect(buyer1).buyItem1155(tokenId1)
        ).to.be.revertedWith("Marketplace: No allowance to send a token");

        // апрувнем достаточно количество ERC20 и совершим покупку
        let sellerBalanceBefore = await erc20.balanceOf(seller.address);

        let tx  = await erc20.connect(buyer1).approve(marketplace.address, cost);
        await tx.wait();
        tx  = await marketplace.connect(buyer1).buyItem1155(tokenId1);
        await tx.wait();
        
        // проверим, что всё прошло правильно
        expect(await erc1155.balanceOf(buyer1.address, tokenId1)).equal(amount);
        expect(await erc20.balanceOf(seller.address)).equal(sellerBalanceBefore.add(cost));
    });

    // отменим продажу ещё одного ERC1155 токена
    it("check cancel1155()", async function () {
    
        const amount = 5;

        // проверим, что только владелец токена может отменить сделку
        await expect(
            marketplace.connect(hacker).cancel1155(tokenId2)
        ).to.be.revertedWith("Marketplace: Caller is not are owner token");

        let tx  = await marketplace.connect(seller).cancel1155(tokenId2);
        await tx.wait();
        
        // проверим, что токен вернулся на адрес seller
        expect(await erc1155.balanceOf(seller.address, tokenId2)).equal(amount);
        
        // проверим, что нельзя отменить продажу токена, который не продаётся
        await expect(
            marketplace.connect(hacker).cancel1155(tokenId2)
        ).to.be.revertedWith("Marketplace: No such token for sale");
    });

    // Выставим токены на аукцион
    it("check listItemOnAuction1155()", async function(){

        const amount = 5;
        const cost = 100;

        // убедимся, что токен на продажу может выставлять только его владелец
        await expect(
            marketplace.connect(hacker).listItemOnAuction1155(tokenId2, amount, cost)
        ).to.be.revertedWith("Marketplace: Caller does not have as many tokens");

        // убедимся, что нельзя выставлять токен на продажу не апрувнв его
        let tx = await erc1155.connect(seller).setApprovalForAll(marketplace.address, false);
        await tx.wait();
        await expect(
            marketplace.connect(seller).listItemOnAuction1155(tokenId2, amount, cost)
        ).to.be.revertedWith("Marketplace: No allowance to send a token");

        // апрувнем токены и выставим их на продажу
        tx = await erc1155.connect(seller).setApprovalForAll(marketplace.address, true);
        await tx.wait();
        // ПЕРВЫЙ АУКЦИОН - ТУТ БУДЕТ 3 СТАВВКИ
        tx = await marketplace.connect(seller).listItemOnAuction1155(tokenId2, amount, cost);
        await tx.wait();
        // ВТОРОЙ АУКЦИОН - ТУТ БУДЕТ 1 СТАВВКА
        tx = await marketplace.connect(seller).listItemOnAuction1155(tokenId3, amount, cost);
        await tx.wait();
        // ТРЕТИЙ АУКЦИОН - ТУТ НЕ БУДЕТ СТАВОК
        tx = await marketplace.connect(seller).listItemOnAuction1155(tokenId4, amount, cost);
        await tx.wait();

        // проверим, что токен отправлен на адрес маркетплейса
        expect(await erc1155.balanceOf(marketplace.address, tokenId2)).equal(amount);
        expect(await erc1155.balanceOf(marketplace.address, tokenId3)).equal(amount);
        expect(await erc1155.balanceOf(marketplace.address, tokenId4)).equal(amount);
    })

    // сделаем ставки на один из токенов ERC1155
    it("check makeBid1155()", async function () {
    
        const [bid1, bid2, bid3] = [200, 300, 400];

        // проверим, что нельзя совершить ставку ниже текущей ставки
        await expect(
            marketplace.connect(buyer1).makeBid1155(auctionId1, 50)
        ).to.be.revertedWith("Marketplace: The current price is higher than the bid");

        // проверим, что нельзя совершить покупку не апрувнув ERC20 токены
        await expect(
            marketplace.connect(buyer1).makeBid1155(auctionId1, bid1)
        ).to.be.revertedWith("Marketplace: No allowance to send a token");

        // ПЕРВЫЙ АУКЦИОН - ТУТ БУДЕТ 3 СТАВВКИ

        // сохраним балансы до ставки
        let buyer1BalanceBefore = await erc20.balanceOf(buyer1.address);
        let marketplaceBalanceBefore = await erc20.balanceOf(marketplace.address);

        // апрувнем достаточно количество ERC20 и совершим ставку
        let tx  = await erc20.connect(buyer1).approve(marketplace.address, bid1);
        await tx.wait();
        tx  = await marketplace.connect(buyer1).makeBid1155(auctionId1, bid1)
        await tx.wait();

        // проверим, что всё прошло правильно
        expect(await erc20.balanceOf(buyer1.address)).equal(buyer1BalanceBefore.sub(bid1));
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.add(bid1));

        // сделаем ставку от имени другого покупателя
        let buyer2BalanceBefore = await erc20.balanceOf(buyer2.address);

        tx  = await erc20.connect(buyer2).approve(marketplace.address, bid2);
        await tx.wait();
        tx  = await marketplace.connect(buyer2).makeBid1155(auctionId1, bid2)
        await tx.wait();
        
        // проверим, что всё прошло правильно
        expect(await erc20.balanceOf(buyer1.address)).equal(buyer1BalanceBefore);
        expect(await erc20.balanceOf(buyer2.address)).equal(buyer2BalanceBefore.sub(bid2));
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.add(bid2));

        // сделаем ставку от имени другого покупателя (чтобы аукцион состоялся нужно сделать не менее 3 ставок)
        tx  = await erc20.connect(buyer1).approve(marketplace.address, bid3);
        await tx.wait();
        tx  = await marketplace.connect(buyer1).makeBid1155(auctionId1, bid3)
        await tx.wait();
        
        // проверим, что всё прошло правильно
        expect(await erc20.balanceOf(buyer1.address)).equal(buyer1BalanceBefore.sub(bid3));
        expect(await erc20.balanceOf(buyer2.address)).equal(buyer2BalanceBefore);
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.add(bid3));

        // ВТОРОЙ АУКЦИОН - ТУТ БУДЕТ 1 СТАВВКА

        // сохраним балансы до ставки
        buyer1BalanceBefore = await erc20.balanceOf(buyer1.address);
        marketplaceBalanceBefore = await erc20.balanceOf(marketplace.address);

        // апрувнем достаточно количество ERC20 и совершим ставку
        tx  = await erc20.connect(buyer1).approve(marketplace.address, bid1);
        await tx.wait();
        tx  = await marketplace.connect(buyer1).makeBid1155(auctionId2, bid1)
        await tx.wait();

        // проверим, что всё прошло правильно
        expect(await erc20.balanceOf(buyer1.address)).equal(buyer1BalanceBefore.sub(bid1));
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.add(bid1));
    });

    // завершаем аукцион токенов ERC1155
    it("check finishAuction1155()", async function () {
    
        const amount = 5;
        const [bid1, bid3] = [200, 400];

        // проверим, что нельзя завершить аукцион, если не прошло 3 дня
        await expect(
            marketplace.connect(buyer1).finishAuction1155(auctionId1)
        ).to.be.revertedWith("Marketplace: Auction is not yet over");

        // переводим время на 3 дня вперёд
        await ethers.provider.send('evm_increaseTime', [259200]);

        // проверим, что нельзя сделать ставку, если время аукциона закончилось
        await expect(
            marketplace.connect(buyer1).makeBid1155(auctionId1, bid3)
        ).to.be.revertedWith("Marketplace: Auction is over");

        // ЗАВЕРШАЕМ ПЕРВЫЙ АУКЦИОН С 3 СТАВКАМИ

        // сохраняем балансы
        let sellerBalanceBefore = await erc20.balanceOf(seller.address);
        let marketplaceBalanceBefore = await erc20.balanceOf(marketplace.address);
        // завершаем 1 аукцион, в котором было 3 ставки
        let tx  = await marketplace.finishAuction1155(auctionId1);
        await tx.wait();

        // проверяем, что всё сработало правильно
        expect(await erc721.ownerOf(tokenId2)).equal(buyer1.address);
        expect(await erc20.balanceOf(seller.address)).equal(sellerBalanceBefore.add(bid3));
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.sub(bid3));

        // ЗАВЕРШАЕМ ВТОРОЙ АУКЦИОН С 1 СТАВКОЙ

        // сохраняем балансы
        let buyer1BalanceBefore = await erc20.balanceOf(buyer1.address);
        marketplaceBalanceBefore = await erc20.balanceOf(marketplace.address);

        // завершаем 2 аукцион, в котором была 1 ставка
        tx  = await marketplace.finishAuction1155(auctionId2);
        await tx.wait();

        // проверяем, что всё сработало правильно
        expect(await erc1155.balanceOf(seller.address, tokenId3)).equal(amount);
        expect(await erc20.balanceOf(buyer1.address)).equal(buyer1BalanceBefore.add(bid1));
        expect(await erc20.balanceOf(marketplace.address)).equal(marketplaceBalanceBefore.sub(bid1));

        // ЗАВЕРШАЕМ ТРЕТИЦ АУКЦИОН БЕЗ СТАВОК

        // завершаем 3 аукцион, в котором не было ставок
        tx  = await marketplace.finishAuction1155(tokenId3);
        await tx.wait();

        // проверяем, что всё сработало правильно
        expect(await erc1155.balanceOf(seller.address, tokenId4)).equal(amount);
    });
});
