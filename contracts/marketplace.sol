// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

contract MyMarketplace{

    IERC20 token20;
    IERC721 token721;
    IERC1155 token1155;

    struct tList721{
        address tokenOwner;
        uint256 tokenId;
        uint256 cost;
    }
    struct tListAuction721{
        address tokenOwner;
        address lastCustomer;
        uint256 tokenId;
        uint256 currentCost;
        uint256 time;
        uint24 bidCount;
    }
    struct tList1155{
        address tokenOwner;
        uint256 tokenId;
        uint256 amount;
        uint256 cost;
    }
    struct tListAuction1155{
        address tokenOwner;
        address lastCustomer;
        uint256 tokenId;
        uint256 amount;
        uint256 currentCost;
        uint256 time;
        uint24 bidCount;
    }

    uint256 private _tListId721;
    uint256 private _tListAuctionId721;
    uint256 private _tokenListId1155;
    uint256 private _tokenListOnAuctionId1155;

    mapping(uint256 => tList721) private _tList721;
    mapping(uint256 => tListAuction721) private _tListAuction721;
    mapping(uint256 => tList1155) private _tList1155;
    mapping(uint256 => tListAuction1155) private _tListAuction1155;

    event ListItem(uint256 id, uint256 tokenId, uint256 amount, uint256 cost);
    event BuyItem(uint256 id);
    event Cancel(uint256 id);
    event ListItemOnAuction(uint256 id, uint256 tokenId, uint256 amount, uint256 cost);
    event MakeBid(uint256 id, uint256 cost);
    event FinishAuction(uint256 id);

    constructor(address _tokenAddress20, address _tokenAddress721, address _tokenAddress1155) {
        token20 = IERC20(_tokenAddress20);
        token721 = IERC721(_tokenAddress721);
        token1155 = IERC1155(_tokenAddress1155);
    }

    /* Функция для продажи и покупки токенов ERC721 */

    function createItem721(address to, string memory tokenURI) external returns(uint256){
        return token721.mint(to, tokenURI);
    }

    function listItem721(uint256 tokenId, uint256 cost) external returns(uint256) {
        // проверяем, что продавец владелец токена
        require(msg.sender == token721.ownerOf(tokenId), 
                "Marketplace: Caller is not are owner token");
        // проверяем, что продавец апрувнул токены для маркетплейса
        require(address(this) == token721.getApproved(tokenId) ||
                token721.isApprovedForAll(msg.sender,  address(this)) == true,
                "Marketplace: No allowance to send a token");
        // морозим токены на маркетплейсе
        token721.safeTransferFrom(msg.sender, address(this), tokenId);
        // сохраняем списке на продажу
        _tListId721++;
        _tList721[_tListId721] = tList721(msg.sender, tokenId,  cost);

        emit ListItem(_tListId721, tokenId, 1, cost);
        return _tListId721;
    }

    function buyItem721(uint256 id) external {
        // проверяем, что покупатель апрувнул достаточно токенов
        require(token20.allowance(msg.sender, address(this)) >= _tList721[id].cost,
                "Marketplace: No allowance to send a token");
        // отправляем значит ERC20 продавцу, а ERC721 покупателю
        token20.transferFrom(msg.sender, _tList721[id].tokenOwner, _tList721[id].cost);
        token721.safeTransferFrom(address(this), msg.sender, _tList721[id].tokenId);
        emit BuyItem(id);
    }

    function cancel721(uint256 id) external {
        require(address(0) != _tList721[id].tokenOwner, "Marketplace: No such token for sale");
        require(msg.sender == _tList721[id].tokenOwner, "Marketplace: Caller is not are owner token");
        token721.safeTransferFrom(address(this), msg.sender, _tList721[id].tokenId);
        delete _tList721[id];
        emit Cancel(id);
    }

    function listItemOnAuction721(uint256 tokenId, uint256 minCost) external returns(uint256) {
        // проверяем, что продавец владелец токена
        require(msg.sender == token721.ownerOf(tokenId), 
                "Marketplace: Caller is not are owner token");
        // проверяем, что продавец апрувнул токены для маркетплейса
        require(address(this) == token721.getApproved(tokenId) ||
                token721.isApprovedForAll(msg.sender,  address(this)) == true,
                "Marketplace: No allowance to send a token");
        // морозим токены на маркетплейсе
        token721.safeTransferFrom(msg.sender, address(this), tokenId);
        // сохраняем списке на продажу
        _tListAuctionId721++;
        _tListAuction721[_tListAuctionId721] = tListAuction721(msg.sender, address(0), tokenId,  minCost, block.timestamp, 0);

        emit ListItemOnAuction(_tListAuctionId721, tokenId, 1, minCost);
        return _tListAuctionId721;
    }

    function makeBid721(uint256 id, uint256 bid) external returns(bool) {
        // проверим, что время ещё не вышло
        require(block.timestamp < _tListAuction721[id].time + 259200,
                "Marketplace: Auction is over");
        // проверяем, что ставка выше текущей цены
        require(bid > _tListAuction721[id].currentCost,
                "Marketplace: The current price is higher than the bid");
        // проверяем, что покупатель апрувнул достаточно токенов
        require(token20.allowance(msg.sender, address(this)) >= bid,
                "Marketplace: No allowance to send a token");

        // отправляем ERC20 от нового покупателя на маркетплейс 
        token20.transferFrom(
            msg.sender,
            address(this),
            bid
        );
        
        // отправляем ERC20 из маркетплейса предыдущему покупателю (у которого была самая высокая ставка)
        if(_tListAuction721[id].lastCustomer != address(0)){
            token20.transfer(
                _tListAuction721[id].lastCustomer,
                _tListAuction721[id].currentCost
            );
        }

        // сохраняем значение новой максимальной ставки, адрес того, кто её сделал и увеличиваем количество ставок
        _tListAuction721[id].lastCustomer = msg.sender;
        _tListAuction721[id].currentCost = bid;
        _tListAuction721[id].bidCount++;

        emit MakeBid(id, bid);
        return true;
    }

    function finishAuction721(uint256 id) external {
        require(block.timestamp > _tListAuction721[id].time + 259200,
                "Marketplace: Auction is not yet over");
        if(_tListAuction721[id].bidCount > 2){
            // отправляем ERC20 продовцу, а ERC721 покупателю
            token20.transfer(
                _tListAuction721[id].tokenOwner,
                _tListAuction721[id].currentCost
            );
            token721.safeTransferFrom(
                address(this),
                _tListAuction721[id].lastCustomer,
                _tListAuction721[id].tokenId
            );
        } else {
            // аукцион не состоялся, возвращаем ERC20 покупателю, если таковой был, а ERC721 продавцу
            if (_tListAuction721[id].lastCustomer != address(0)){
                token20.transfer(
                    _tListAuction721[id].lastCustomer,
                    _tListAuction721[id].currentCost
                );
            }
            token721.safeTransferFrom(
                address(this),
                _tListAuction721[id].tokenOwner,
                _tListAuction721[id].tokenId
            );
        }
        emit FinishAuction(id);
    }

    /* Функция для продажи и покупки токенов ERC1155 */

    function createItem1155(address to, uint256 tokenId, uint256 amount, string memory tokenURI) external {
        token1155.mint(to, tokenId, amount, tokenURI);
    }

    function listItem1155(uint256 tokenId, uint256 amount, uint256 cost) external returns(uint256) {
        // проверяем, что продавец владелец заявленными токенами
        require(amount == token1155.balanceOf(msg.sender, tokenId), 
                "Marketplace: Caller does not have as many tokens");
        // проверяем, что продавец апрувнул токены для маркетплейса
        require(token1155.isApprovedForAll(msg.sender, address(this)) == true,
                "Marketplace: No allowance to send a token");
        // морозим токены на маркетплейсе
        token1155.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
        // сохраняем списке на продажу
        _tokenListId1155++;
        _tList1155[_tokenListId1155] = tList1155(msg.sender, tokenId, amount, cost);
        
        emit ListItem(_tokenListId1155, tokenId, amount, cost);
        return _tokenListId1155;
    }

    function buyItem1155(uint256 id) external {
        // проверяем, что покупатель апрувнул достаточно токенов
        require(token20.allowance(msg.sender, address(this)) >= _tList1155[id].cost,
                "Marketplace: No allowance to send a token");
        // отправляем значит ERC20 продавцу, а ERC721 покупателю
        token20.transferFrom(msg.sender, _tList1155[id].tokenOwner, _tList1155[id].cost);
        token1155.safeTransferFrom(address(this), msg.sender, _tList1155[id].tokenId, _tList1155[id].amount, "");
        
        emit BuyItem(id);
    }

    function cancel1155(uint256 id) external {
        require(address(0) != _tList1155[id].tokenOwner, "Marketplace: No such token for sale");
        require(msg.sender == _tList1155[id].tokenOwner, "Marketplace: Caller is not are owner token");
        token1155.safeTransferFrom(address(this), msg.sender, _tList1155[id].tokenId, _tList1155[id].amount, "");
        delete _tList1155[id];
        
        emit Cancel(id);
    }

    function listItemOnAuction1155(uint256 tokenId, uint256 amount, uint256 minCost) external returns(uint256) {
        // проверяем, что продавец владелец заявленными токенами
        require(amount == token1155.balanceOf(msg.sender, tokenId), 
                "Marketplace: Caller does not have as many tokens");
        // проверяем, что продавец апрувнул токены для маркетплейса
        require(token1155.isApprovedForAll(msg.sender, address(this)) == true,
                "Marketplace: No allowance to send a token");
        // морозим токены на маркетплейсе
        token1155.safeTransferFrom(msg.sender, address(this), tokenId, amount, "");
        // сохраняем в списке на продажу
        // сохраняем списке на продажу
        _tokenListOnAuctionId1155++;
        _tListAuction1155[_tokenListOnAuctionId1155] = tListAuction1155(msg.sender, address(0), tokenId, amount, minCost, block.timestamp, 0);
        
        emit ListItemOnAuction(_tListAuctionId721, tokenId, amount, minCost);
        return _tokenListOnAuctionId1155;
    }

    function makeBid1155(uint256 id, uint256 bid) external returns(bool) {
        // проверим, что время ещё не вышло
        require(block.timestamp < _tListAuction1155[id].time + 259200,
                "Marketplace: Auction is over");
        // проверяем, что ставка выше текущей цены
        require(bid > _tListAuction1155[id].currentCost,
                "Marketplace: The current price is higher than the bid");
        // проверяем, что покупатель апрувнул достаточно токенов
        require(token20.allowance(msg.sender, address(this)) >= bid,
                "Marketplace: No allowance to send a token");

        // отправляем ERC20 от нового покупателя на маркетплейс 
        token20.transferFrom(
            msg.sender,
            address(this),
            bid
        );
        // отправляем ERC20 из маркетплейса предыдущему покупателю (у которого была самая высокая ставка)
        if(_tListAuction1155[id].lastCustomer != address(0)){
            token20.transfer(
                _tListAuction1155[id].lastCustomer,
                _tListAuction1155[id].currentCost
            );
        }
        // сохраняем значение новой максимальной ставки, адрес того, кто её сделал и увеличиваем количество ставок
        _tListAuction1155[id].lastCustomer = msg.sender;
        _tListAuction1155[id].currentCost = bid;
        _tListAuction1155[id].bidCount++;

        emit MakeBid(id, bid);
        return true;
    }

    function finishAuction1155(uint256 id) external {
        require(block.timestamp > _tListAuction1155[id].time + 259200,
                "Marketplace: Auction is not yet over");
        if(_tListAuction1155[id].bidCount > 2){
            // отправляем ERC20 продовцу, а ERC721 покупателю
            token20.transfer(
                _tListAuction1155[id].tokenOwner,
                _tListAuction1155[id].currentCost
            );
            token1155.safeTransferFrom(
                address(this),
                _tListAuction1155[id].lastCustomer,
                _tListAuction1155[id].tokenId,
                _tListAuction1155[id].amount,
                ""
            );
        } else {
            // аукцион не состоялся, возвращаем ERC20 покупателю, если таковой был, а ERC721 продавцу
            if (_tListAuction1155[id].lastCustomer != address(0)){
                token20.transfer(
                    _tListAuction1155[id].lastCustomer,
                    _tListAuction1155[id].currentCost
                );
            }
            token1155.safeTransferFrom(
                address(this),
                _tListAuction1155[id].tokenOwner,
                _tListAuction1155[id].tokenId,
                _tListAuction1155[id].amount,
                ""
            );
        }
        emit FinishAuction(id);
    }
    
    function onERC721Received(address , address , uint256 , bytes memory) external pure returns (bytes4){
        return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    }

    function onERC1155Received(address , address , uint256 , uint256 , bytes memory) external pure returns (bytes4){
        return bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
    }
}