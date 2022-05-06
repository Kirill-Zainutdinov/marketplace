// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


contract TEST{

    function onERC721Received(address , address , uint256 , bytes memory) external pure returns (bytes4){
        return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    }

    function onERC1155Received(address , address , uint256 , uint256 , bytes memory) external pure returns (bytes4){
        return bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)"));
    }

    function onERC1155BatchReceived(address , address , uint256[] calldata , uint256[] calldata , bytes memory) external pure returns (bytes4){
        return bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"));
    }
}