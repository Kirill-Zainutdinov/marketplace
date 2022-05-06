// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";


contract MyERC1155 is  ERC165, IERC1155, IERC1155MetadataURI, AccessControl {
    using Address for address;
    using Strings for uint256;

    // Token name
    string public name;
    // Token symbol
    string public symbol;

    bytes32 public constant tokenOwner = keccak256("owner");
    bytes32 public constant minter = keccak256("minter");

    // Existing tokens ids
    mapping(uint256 => bool) _tokenIds; 
    // Mapping from token ID to account balances
    mapping(uint256 => mapping(address => uint256)) private _balances;
    // Mapping from account to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    // Mapping from tokens uri
    mapping(uint256 => string) private _tokenURIs;


    constructor(string memory _name, string memory _symbol) {
        _setRoleAdmin(tokenOwner, tokenOwner);
        _grantRole(tokenOwner, msg.sender);
        _setRoleAdmin(minter, tokenOwner);
        _grantRole(minter, msg.sender);
        name = _name;
        symbol = _symbol;
    }

    /**
     * @dev mint single token
     */
    function mint(
        address to,
        uint256 tokenId,
        uint256 amount,
        string memory _tokenURI
    ) 
        public
        virtual
        override
    {
        require(hasRole(minter, msg.sender), "ERC1155: You are not owner");
        require(to != address(0), "ERC1155: mint to the zero address");
        require(_tokenIds[tokenId] == false ||
                _tokenIds[tokenId] == true &&
                keccak256(bytes(_tokenURIs[tokenId])) == keccak256(bytes(_tokenURI)),
                "ERC1155: You cannot change the metadata of an existing token");

        _balances[tokenId][to] += amount;
        _tokenIds[tokenId] = true;
        _tokenURIs[tokenId] = _tokenURI;

        emit TransferSingle(msg.sender, address(0), to, tokenId, amount);
    }

    /**
     * @dev mint multi token
     */
    function mintBatch(
        address to,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        string[] memory tokenURIs
    )
        public
    {
        require(hasRole(minter, msg.sender), "ERC1155: You are not owner");
        require(to != address(0), "ERC1155: mint to the zero address");
        require(tokenIds.length == amounts.length, "ERC1155: ids and amounts length mismatch");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(_tokenIds[tokenIds[i]] == false ||
                    _tokenIds[tokenIds[i]] == true &&
                    keccak256(bytes(_tokenURIs[tokenIds[i]])) == keccak256(bytes(tokenURIs[i])),
                    "ERC1155: You cannot change the metadata of an existing token");
        }

        for (uint256 i = 0; i < tokenIds.length; i++) {
            _balances[tokenIds[i]][to] += amounts[i];
            if(!_tokenIds[tokenIds[i]]){
                _tokenIds[tokenIds[i]] = true;
            }
            _tokenURIs[tokenIds[i]] = tokenURIs[i];
        }

        emit TransferBatch(msg.sender, address(0), to, tokenIds, amounts);
    }

    /**
     * @dev See {IERC1155MetadataURI-uri}.
     */
    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        require(_tokenIds[tokenId], "ERC1155Metadata: URI query for nonexistent token");
        return _tokenURIs[tokenId];
    }

    /**
     * @dev See {IERC1155-balanceOf}.
     */
    function balanceOf(address account, uint256 id) public view virtual override returns (uint256) {
        require(account != address(0), "ERC1155: balance query for the zero address");
        
        return _balances[id][account];
    }

    /**
     * @dev See {IERC1155-balanceOfBatch}.
     */
    function balanceOfBatch(address[] memory accounts, uint256[] memory ids)
        public
        view
        virtual
        override
        returns (uint256[] memory)
    {
        require(accounts.length == ids.length, "ERC1155: accounts and ids length mismatch");

        uint256[] memory batchBalances = new uint256[](accounts.length);

        for (uint256 i = 0; i < accounts.length; ++i) {
            batchBalances[i] = balanceOf(accounts[i], ids[i]);
        }

        return batchBalances;
    }

    /**
     * @dev See {IERC1155-setApprovalForAll}.
     */
    function setApprovalForAll(address operator, bool approved) public virtual override {
        require(msg.sender != operator, "ERC1155: setting approval status for self");

        _operatorApprovals[msg.sender][operator] = approved;

        emit ApprovalForAll(msg.sender, operator, approved);
    }

    /**
     * @dev See {IERC1155-isApprovedForAll}.
     */
    function isApprovedForAll(address account, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[account][operator];
    }

    /**
     * @dev See {IERC1155-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        require(
            msg.sender == from || _operatorApprovals[from][msg.sender],
            "ERC1155: caller is not owner nor approved"
        );
        _safeTransferFrom(from, to, id, amount, data);
    }

    /**
     * @dev See {IERC1155-safeBatchTransferFrom}.
     */
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override {
        require(
            msg.sender == from || _operatorApprovals[from][msg.sender],
            "ERC1155: caller is not owner nor approved"
        );
        _safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    /**
     * @dev Transfers `amount` tokens of token type `id` from `from` to `to`.
     */
    function _safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal virtual {
        require(to != address(0), "ERC1155: transfer to the zero address");
        address operator = msg.sender;
        require(_doSafeTransferAcceptanceCheck(operator, from, to, id, amount, data), 
                "ERC1155: transfer to non ERC1155Receiver implementer");

        uint256 fromBalance = _balances[id][from];
        require(fromBalance >= amount, "ERC1155: insufficient balance for transfer");
        unchecked {
            _balances[id][from] = fromBalance - amount;
        }
        _balances[id][to] += amount;

        emit TransferSingle(operator, from, to, id, amount);

    }

    /**
     * @dev xref:ROOT:erc1155.adoc#batch-operations[Batched] version of {_safeTransferFrom}.
     */
    function _safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual {
        require(ids.length == amounts.length, "ERC1155: ids and amounts length mismatch");
        require(to != address(0), "ERC1155: transfer to the zero address");
        address operator = msg.sender;
        require(_doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, amounts, data), 
                "ERC1155: transfer to non ERC1155Receiver implementer");
            
        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids[i];
            uint256 amount = amounts[i];

            uint256 fromBalance = _balances[id][from];
            require(fromBalance >= amount, "ERC1155: insufficient balance for transfer");
            unchecked {
                _balances[id][from] = fromBalance - amount;
            }
            _balances[id][to] += amount;
        }

        emit TransferBatch(operator, from, to, ids, amounts);

        _doSafeBatchTransferAcceptanceCheck(operator, from, to, ids, amounts, data);
    }

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) private returns(bool){
        if (to.isContract()) {
            try IERC1155Receiver(to).onERC1155Received(operator, from, id, amount, data) returns (bytes4 response) {
                return response == IERC1155Receiver.onERC1155Received.selector;
            } catch {
                return false;
            }
        } else {
            return true;
        }
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) private returns(bool){
        if (to.isContract()) {
            try IERC1155Receiver(to).onERC1155BatchReceived(operator, from, ids, amounts, data) returns (bytes4 response) {
                return response == IERC1155Receiver.onERC1155BatchReceived.selector;
            } catch {
                return false;
            }
        } else {
            return true;
        }
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165, AccessControl) returns (bool) {
        return
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC1155MetadataURI).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}