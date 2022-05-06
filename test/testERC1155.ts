import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Bytes } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MyERC1155, MyERC1155__factory, TEST, TEST__factory } from "../typechain";
import { string } from "hardhat/internal/core/params/argumentTypes";
import { BytesLike } from "@ethersproject/bytes";

describe("Testing ERC1155",  function () {

  let erc1155 : MyERC1155;
  let test : TEST;
  let testFactory : TEST__factory;
  let signers : SignerWithAddress[];
  let owner : SignerWithAddress;
  let spender : SignerWithAddress;
  let operator : SignerWithAddress;
  let recipient : SignerWithAddress;
  let hacker : SignerWithAddress;
  let zeroAddress : string;
  let uris : Array<string> = [];
  // аргументы для конструктора контракта
  const name = "HappyRoger1155";
  const symbol = "HR1155";
  const baseUri = "https://gateway.pinata.cloud/ipfs/QmRLaoJoLxcsEhA3JXs3FeShJJXyAfVTSw7KvrJfV554MA/";

  before(async function(){
    signers = await ethers.getSigners();
    [owner, spender, operator, recipient, hacker] = await ethers.getSigners();
    zeroAddress = "0x0000000000000000000000000000000000000000";

    for(let i = 1; i < 6; i++){
      uris.push(baseUri + i.toString());
    }

    const ER1155Factory = (await ethers.getContractFactory("MyERC1155"));
    erc1155 = await ER1155Factory.deploy(name, symbol);

    testFactory = (await ethers.getContractFactory("TEST"));
    test = await testFactory.deploy();
  })

  // проверяем публичное поле name
  it("check name()", async function(){
    expect(await erc1155.name()).equal(name);
  })

  // проверяем публичное поле symbol
  it("check symbol()", async function(){
    expect(await erc1155.symbol()).equal(symbol);
  })

  // проверяем работу функции mint() а за одно функцию balanceOf() и публичное поле totalSupply
  it("check mint() and balanceOf()", async function () {

    // будем выпускать 1 токен
    let tokenId = 1;
    const amount = 10;
    // баланс целевого адреса
    // до вызова функции mint()
    const balanceBefore = await erc1155.balanceOf(owner.address, tokenId);

    // делаем эмиссию 10 токенов с id 1
    let tx  = await erc1155.mint(owner.address, tokenId, amount, uris[0]);
    await tx.wait();

    // баланс целевого адреса
    // после вызова функции mint()
    const balanceAfter = await erc1155.balanceOf(owner.address, tokenId);

    // проверка результатов
    expect(await balanceBefore.add(amount)).equal(balanceAfter);

    // попытка вызвать функцию mint() не от имени owner
    await expect(
      erc1155.connect(hacker).mint(hacker.address, tokenId, amount, uris[0])
    ).to.be.revertedWith("ERC1155: You are not owner");

    // попытка заминтить токены на нулевой адрес
    await expect(
      erc1155.mint(zeroAddress, tokenId, amount, uris[0])
    ).to.be.revertedWith("ERC1155: mint to the zero address");

    // попытка создать ещё токены с тем же id, но другими метаданными
    await expect(
      erc1155.mint(owner.address, tokenId, amount, uris[1])
    ).to.be.revertedWith("ERC1155: You cannot change the metadata of an existing token");

    // попытка проверить баланс нулевого адреса
    await expect(
      erc1155.balanceOf(zeroAddress, tokenId)
    ).to.be.revertedWith("ERC1155: balance query for the zero address");
  });

  // проверяем работу функции mintBatch() а за одно функцию balanceOfBatch() и публичное поле totalSupply
  it("check mintBatch() and balanceOfBatch()", async function () {

    // будем выпускать 4 токена
    const tokenIds = [2, 3];
    const amount = 10;
    // баланс целевых адресов
    // до вызова функции mintBatch()
    const balanceBefore = await erc1155.balanceOfBatch([owner.address, spender.address], tokenIds);

    // делаем эмиссию токенов на два адреса
    let tx  = await erc1155.mintBatch(owner.address, tokenIds, [amount, amount], [uris[1], uris[2]]);
    await tx.wait();
    tx  = await erc1155.mintBatch(spender.address, tokenIds, [amount, amount], [uris[1], uris[2]]);
    await tx.wait();

    // баланс целевых адресов
    // после вызова функции mintBatch()
    const balanceAfter = await erc1155.balanceOfBatch([owner.address, spender.address], tokenIds);

    // проверка результатов
    expect(await balanceBefore[0].add(amount)).equal(balanceAfter[0]);
    expect(await balanceBefore[1].add(amount)).equal(balanceAfter[1]);

    // попытка вызвать функцию mintBatch() не от имени owner
    await expect(
      erc1155.connect(hacker).mintBatch(hacker.address, tokenIds, [amount, amount], [uris[1], uris[2]])
    ).to.be.revertedWith("ERC1155: You are not owner");

    // попытка заминтить токены на нулевой адрес
    await expect(
      erc1155.mintBatch(zeroAddress, tokenIds, [amount, amount], [uris[1], uris[2]])
    ).to.be.revertedWith("ERC1155: mint to the zero address");

    // попытка заминтить токены отправив массивы разных размеров
    await expect(
      erc1155.mintBatch(owner.address, tokenIds, [amount, amount, amount], [uris[1], uris[2]])
    ).to.be.revertedWith("ERC1155: ids and amounts length mismatch");

    // попытка заминтить токены с уже существующими id но другими метаданными
    await expect(
      erc1155.mintBatch(owner.address, tokenIds, [amount, amount], [uris[3], uris[4]])
    ).to.be.revertedWith("ERC1155: You cannot change the metadata of an existing token");

    // попытка проверить отправив массивы разных размеров
    await expect(
      erc1155.balanceOfBatch([owner.address, spender.address, hacker.address], tokenIds)
    ).to.be.revertedWith("ERC1155: accounts and ids length mismatch");
  });


  it("check uri()", async function () {
    // проверим uri всех созданных токенов
    for(let id = 1; id < 4; id++){
      expect(await erc1155.uri(id)).equal(baseUri + id.toString());
    }
    // попытка узнать uri несуществующего токена
    await expect(
      erc1155.uri(4)
    ).to.be.revertedWith("ERC1155Metadata: URI query for nonexistent token");    
  });

  it("check setApprovalForAll() and isApprovedForAll()", async function () {

    // проверяем, что operator ещё не назначен
    expect(await erc1155.isApprovedForAll(owner.address, operator.address)).equal(false);

    // назначаем оператора
    let tx  = await erc1155.setApprovalForAll(operator.address, true);
    await tx.wait();

    // проверим, что функция сработала правильно
    expect(await erc1155.isApprovedForAll(owner.address, operator.address)).equal(true);

    // отменяем назначение оператора
    tx  = await erc1155.setApprovalForAll(operator.address, false);
    await tx.wait();

    // проверим, что функция сработала правильно
    expect(await erc1155.isApprovedForAll(owner.address, operator.address)).equal(false);

    // проверим, что нельзя назначить оператором владельца токена
    await expect(
      erc1155.setApprovalForAll(owner.address, true)
    ).to.be.revertedWith("ERC1155: setting approval status for self");  
  });

  it("check safeTransferFrom()", async function () {
    
    const tokenId = 1;
    const amount = 5;
    // сохраним балансы до трансфера
    let ownerBalanceBefore = await erc1155.balanceOf(owner.address, tokenId);
    let recipientBalanceBefore = await erc1155.balanceOf(recipient.address, tokenId);

    // отправляем токен на адрес 
    let tx  = await erc1155.functions.safeTransferFrom(owner.address, recipient.address, tokenId, amount, "0x00");
    await tx.wait();
    // проверяем изменение балансов
    expect(await erc1155.balanceOf(owner.address, tokenId)).equal(ownerBalanceBefore.sub(BigNumber.from(amount)));
    expect(await erc1155.balanceOf(recipient.address, tokenId)).equal(recipientBalanceBefore.add(BigNumber.from(amount)));


    // проверим, что нельзя отправлять токен не от имени владельца
    await expect(
      erc1155.connect(hacker).safeTransferFrom(owner.address, hacker.address, tokenId, amount, "0x00")
    ).to.be.revertedWith("ERC1155: caller is not owner nor approved");

    // проверим, что нельзя отправлять токен на нулевой адрес
    await expect(
      erc1155.safeTransferFrom(owner.address, zeroAddress, tokenId, amount, "0x00")
    ).to.be.revertedWith("ERC1155: transfer to the zero address"); 

    // отправим на адрес контракта и убедимся, что всё работает
    ownerBalanceBefore = await erc1155.balanceOf(owner.address, tokenId);
    let contractBalanceBefore = await erc1155.balanceOf(test.address, tokenId);

    tx  = await erc1155.safeTransferFrom(owner.address, test.address, tokenId, amount, "0x00")
    await tx.wait();

    expect(await erc1155.balanceOf(owner.address, tokenId)).equal(ownerBalanceBefore.sub(BigNumber.from(amount)));
    expect(await erc1155.balanceOf(test.address, tokenId)).equal(contractBalanceBefore.add(BigNumber.from(amount)));

    // поытка отправить токен на контракт, у которого нет этого интерфейса
    await expect(
      erc1155.safeTransferFrom(owner.address, erc1155.address, 2, amount, "0x00")
    ).to.be.revertedWith("ERC1155: transfer to non ERC1155Receiver implementer");

    // проверим, что нельзя отправлять токен, если при недостаточном балансе
    await expect(
      erc1155.safeTransferFrom(owner.address, recipient.address, tokenId, amount, "0x00")
    ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
  });


  it("check safeBatchTransferFrom()", async function () {
    
    // будем отправлять 4 токена
    const tokenId2 = 2;
    const tokenId3 = 3;
    const amount = 5;
    // баланс целевых адресов
    // до вызова функции safeBatchTransferFrom()
    let balanceBefore2 = await erc1155.balanceOfBatch([owner.address, recipient.address], [tokenId2, tokenId2]);
    let balanceBefore3 = await erc1155.balanceOfBatch([owner.address, recipient.address], [tokenId3, tokenId3]);

    // отправляем токен на адрес 
    let tx  = await erc1155.safeBatchTransferFrom(owner.address, recipient.address, [tokenId2, tokenId3], [amount, amount], "0x00");
    await tx.wait();

    // баланс целевых адресов
    // после вызова функции mintBatch()
    let balanceAfter2 = await erc1155.balanceOfBatch([owner.address, recipient.address], [tokenId2, tokenId2]);
    let balanceAfter3 = await erc1155.balanceOfBatch([owner.address, recipient.address], [tokenId3, tokenId3]);

    // проверка результатов
    expect(await balanceBefore2[0].sub(amount)).equal(balanceAfter2[0]);
    expect(await balanceBefore2[1].add(amount)).equal(balanceAfter2[1]);
    expect(await balanceBefore3[0].sub(amount)).equal(balanceAfter3[0]);
    expect(await balanceBefore3[1].add(amount)).equal(balanceAfter3[1]);


    // проверим, что нельзя отправлять токен не от имени владельца
    await expect(
      erc1155.connect(hacker).safeBatchTransferFrom(owner.address, hacker.address, [tokenId2, tokenId3], [amount, amount], "0x00")
    ).to.be.revertedWith("ERC1155: caller is not owner nor approved");

    // проверим, что нельзя отправлять токен на нулевой адрес
    await expect(
      erc1155.safeBatchTransferFrom(owner.address, zeroAddress, [tokenId2, tokenId3], [amount, amount], "0x00")
    ).to.be.revertedWith("ERC1155: transfer to the zero address"); 

    // проверим, что размеры массиовов должны быть одинаковые
    await expect(
      erc1155.safeBatchTransferFrom(owner.address, recipient.address, [tokenId2, tokenId3], [amount, amount, amount], "0x00")
    ).to.be.revertedWith("ERC1155: ids and amounts length mismatch"); 

    // отправим на адрес контракта и убедимся, что всё работает
    // баланс целевых адресов
    // до вызова функции safeBatchTransferFrom()
    balanceBefore2 = await erc1155.balanceOfBatch([owner.address, test.address], [tokenId2, tokenId2]);
    balanceBefore3 = await erc1155.balanceOfBatch([owner.address, test.address], [tokenId3, tokenId3]);

    // отправляем токен на адрес 
    tx  = await erc1155.safeBatchTransferFrom(owner.address, test.address, [tokenId2, tokenId3], [amount, amount], "0x00");
    await tx.wait();

    // баланс целевых адресов
    // после вызова функции mintBatch()
    balanceAfter2 = await erc1155.balanceOfBatch([owner.address, test.address], [tokenId2, tokenId2]);
    balanceAfter3 = await erc1155.balanceOfBatch([owner.address, test.address], [tokenId3, tokenId3]);

    // проверка результатов
    expect(await balanceBefore2[0].sub(amount)).equal(balanceAfter2[0]);
    expect(await balanceBefore2[1].add(amount)).equal(balanceAfter2[1]);
    expect(await balanceBefore3[0].sub(amount)).equal(balanceAfter3[0]);
    expect(await balanceBefore3[1].add(amount)).equal(balanceAfter3[1]);

    // поытка отправить токен на контракт, у которого нет этого интерфейса
    await expect(
      erc1155.safeBatchTransferFrom(owner.address, erc1155.address, [tokenId2, tokenId3], [amount, amount], "0x00")
    ).to.be.revertedWith("ERC1155: transfer to non ERC1155Receiver implementer");

    // проверим, что нельзя отправлять токен, если при недостаточном балансе
    await expect(
      erc1155.safeBatchTransferFrom(owner.address, recipient.address, [tokenId2, tokenId3], [amount, amount], "0x00")
    ).to.be.revertedWith("ERC1155: insufficient balance for transfer");
  });

  it("check supportsInterface()", async function () {
    
    // проверяем интерфейс
    expect(await erc1155.supportsInterface("0x4e2312e0")).equal(false);
  });

});
