import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { MyERC721, MyERC721__factory, TEST, TEST__factory} from "../typechain";
import { string } from "hardhat/internal/core/params/argumentTypes";

describe("Testing ERC721",  function () {

  let erc721 : MyERC721;
  let ERC721Factory : MyERC721__factory;
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
  const name = "HappyRoger721";
  const symbol = "HR721";
  const baseUri = "https://gateway.pinata.cloud/ipfs/QmRLaoJoLxcsEhA3JXs3FeShJJXyAfVTSw7KvrJfV554MA/";

  before(async function(){
    signers = await ethers.getSigners();
    [owner, spender, operator, recipient, hacker] = await ethers.getSigners();
    zeroAddress = "0x0000000000000000000000000000000000000000";

    for(let i = 1; i < 6; i++){
      uris.push(baseUri + i.toString());
    }

    ERC721Factory = (await ethers.getContractFactory("MyERC721"));
    erc721 = await ERC721Factory.deploy(name, symbol);

    testFactory = (await ethers.getContractFactory("TEST"));
    test = await testFactory.deploy();
  })

  // проверяем публичное поле name
  it("check name()", async function(){
    expect(await erc721.name()).equal(name);
  })

  // проверяем публичное поле symbol
  it("check symbol()", async function(){
    expect(await erc721.symbol()).equal(symbol);
  })

  // проверяем работу функции mint() а за одно функцию balanceOf() и публичное поле totalSupply
  it("check mint(), balanceOf() and ownerOf()", async function () {

    // будем выпускать 5 токенов
    const value = BigNumber.from(5);

    // баланс целевого адреса
    // до вызова функции mint()
    const balanceBefore = await erc721.balanceOf(owner.address);

    // делаем эмиссию 5 новых токенов
    for(let i = 0; i < 5; i++){
      let tx  = await erc721.mint(owner.address, uris[0]);
      await tx.wait();
    }

    // баланс целевого адреса
    // после вызова функции mint()
    const balanceAfter = await erc721.balanceOf(owner.address);

    // проверка результатов
    expect(await balanceBefore.add(value)).equal(balanceAfter);

    // владельцем всех выпущенных токенов должен быть owner
    for(let id = 1; id < 6; id++){
      expect(await erc721.ownerOf(id)).equal(owner.address);
    }

    // попытка заминтить токены на нулевой адрес
    await expect(
      erc721.mint(zeroAddress, uris[1])
    ).to.be.revertedWith("ERC721: mint to the zero address");

    // попытка вызвать функцию mint() не от имени owner
    await expect(
      erc721.connect(hacker).mint(hacker.address, uris[1])
    ).to.be.revertedWith("ERC721: you are not owner");

    // попытка проверить баланс нулевого адреса
    await expect(
      erc721.balanceOf(zeroAddress)
    ).to.be.revertedWith("ERC721: balance query for the zero address");

    // попытка узнать владельца несуществующего токена
    await expect(
      erc721.ownerOf(6)
    ).to.be.revertedWith("ERC721: owner query for nonexistent token");    
  });

  it("check tokenUri()", async function () {
    
    // проверим uri всех созданных токенов
    expect(await erc721.tokenURI(1)).equal(uris[0]);

    // попытка узнать uri несуществующего токена
    await expect(
      erc721.tokenURI(6)
    ).to.be.revertedWith("ERC721Metadata: URI query for nonexistent token");    
  });

  it("check approve() and getApproved()", async function () {

    // пока ни кому не должно быть разрешено использовать токен 1
    expect(await erc721.getApproved(1)).equal(zeroAddress);

    // разрешим использовать токен 1 адресу spender 
    let tx  = await erc721.approve(spender.address, 1);
    await tx.wait();

    // проверим, что функция сработала правильно
    expect(await erc721.getApproved(1)).equal(spender.address);

    // проверим, что нельзя апрувнуть адрес владельца токена
    await expect(
      erc721.approve(owner.address, 2)
    ).to.be.revertedWith("ERC721: approval to current owner");  

    // попытка проверить несуществующий токен
    await expect(
      erc721.connect(hacker).approve(hacker.address, 2)
    ).to.be.revertedWith("ERC721: approve caller is not owner nor approved for all");  

    // попытка проверить несуществующий токен
    await expect(
      erc721.getApproved(6)
    ).to.be.revertedWith("ERC721: approved query for nonexistent token");  
  });

  it("check setApprovalForAll() and isApprovedForAll()", async function () {

    // проверяем, что operator ещё не назначен
    expect(await erc721.isApprovedForAll(owner.address, operator.address)).equal(false);

    // назначаем оператора
    let tx  = await erc721.setApprovalForAll(operator.address, true);
    await tx.wait();

    // проверим, что функция сработала правильно
    expect(await erc721.isApprovedForAll(owner.address, operator.address)).equal(true);

    // отменяем назначение оператора
    tx  = await erc721.setApprovalForAll(operator.address, false);
    await tx.wait();

    // проверим, что функция сработала правильно
    expect(await erc721.isApprovedForAll(owner.address, operator.address)).equal(false);

    // проверим, что нельзя назначить оператором владельца токена
    await expect(
      erc721.setApprovalForAll(owner.address, true)
    ).to.be.revertedWith("ERC721: approve to caller");  
  });

  it("check transferFrom()", async function () {
    
    // сохраним балансы до трансфера
    let ownerBalanceBefore = await erc721.balanceOf(owner.address);
    let recipientBalanceBefore = await erc721.balanceOf(recipient.address);

    // отправляем токен на адрес 
    let tx  = await erc721.transferFrom(owner.address, recipient.address, 1);
    await tx.wait();

    // проверяем, что у токена сменился владелец
    expect(await erc721.ownerOf(1)).equal(recipient.address);

    // проверяем изменение балансов
    expect(await erc721.balanceOf(owner.address)).equal(ownerBalanceBefore.sub(BigNumber.from(1)));
    expect(await erc721.balanceOf(recipient.address)).equal(recipientBalanceBefore.add(BigNumber.from(1)));

    // проверяем, что spender утратил свои права относительно токена 1
    expect(await erc721.getApproved(1)).equal(zeroAddress);

    // проверим, что нельзя отправлять несуществующий токен
    await expect(
      erc721.transferFrom(owner.address, recipient.address, 6)
    ).to.be.revertedWith("ERC721: operator query for nonexistent token");

    // проверим, что нельзя отправлять токен на нулевой адрес
    await expect(
      erc721.transferFrom(owner.address, zeroAddress, 2)
    ).to.be.revertedWith("ERC721: transfer to the zero address"); 

    // проверим, что нельзя отправлять токен, если вы не являетесь владельцем или оператором
    await expect(
      erc721.connect(hacker).transferFrom(owner.address, hacker.address, 2)
    ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");  
  });

  it("check safeTransferFrom()", async function () {

    // сохраним балансы до трансфера
    let ownerBalanceBefore = await erc721.balanceOf(owner.address);
    let recipientBalanceBefore = await erc721.balanceOf(recipient.address);

    // отправляем токен на адрес 
    let tx  = await erc721["safeTransferFrom(address,address,uint256)"](owner.address, recipient.address, 2);
    await tx.wait();

    // проверяем, что у токена сменился владелец
    expect(await erc721.ownerOf(1)).equal(recipient.address);

    // проверяем изменение балансов
    expect(await erc721.balanceOf(owner.address)).equal(ownerBalanceBefore.sub(BigNumber.from(1)));
    expect(await erc721.balanceOf(recipient.address)).equal(recipientBalanceBefore.add(BigNumber.from(1)));

    // проверим, что нельзя отправлять токен, если вы не являетесь владельцем или оператором
    await expect(
      erc721.connect(hacker)["safeTransferFrom(address,address,uint256)"](owner.address, hacker.address, 2)
    ).to.be.revertedWith("ERC721: transfer caller is not owner nor approved");  

    // отправим на адрес контракта и убедимся, что всё работает
    ownerBalanceBefore = await erc721.balanceOf(owner.address);
    let contractBalanceBefore = await erc721.balanceOf(test.address);

    tx  = await erc721["safeTransferFrom(address,address,uint256)"](owner.address, test.address, 3);
    await tx.wait();

    expect(await erc721.balanceOf(owner.address)).equal(ownerBalanceBefore.sub(BigNumber.from(1)));
    expect(await erc721.balanceOf(test.address)).equal(contractBalanceBefore.add(BigNumber.from(1)));

    // поытка отправить токен на контракт, у которого нет этого интерфейса
    await expect(
      erc721["safeTransferFrom(address,address,uint256)"](owner.address, erc721.address, 4)
    ).to.be.revertedWith("ERC721: transfer to non ERC721Receiver implementer");  
  });

  it("check supportsInterface()", async function () {
    
    // проверяем изменение балансов
    expect(await erc721.supportsInterface("0x4e2312e0")).equal(false);
  });

});
