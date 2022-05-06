// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MyERC721 is ERC165, IERC721, IERC721Metadata, AccessControl {
  using Address for address;
  using Strings for uint256;
  
  // Current token id
  uint256 private _tokenId;
  // Token name
  string private _name;
  // Token symbol
  string private _symbol;
  
  bytes32 public constant tokenOwner = keccak256("owner");
  bytes32 public constant minter = keccak256("minter");

  // словарь с ролями
  mapping(bytes32 => RoleData) public _roles;
  // Mapping from token ID to owner address
  mapping(uint256 => address) private _owners;
  // Mapping owner address to token count
  mapping(address => uint256) private _balances;
  // Mapping from token ID to approved address
  mapping(uint256 => address) private _tokenApprovals;
  // Mapping from owner to operator approvals
  mapping(address => mapping(address => bool)) private _operatorApprovals;
  // Mapping from tokens uri
  mapping(uint256 => string) private _tokenURIs;

  constructor(string memory name_, string memory symbol_) {
    _setRoleAdmin(tokenOwner, tokenOwner);
    _grantRole(tokenOwner, msg.sender);
    _setRoleAdmin(minter, tokenOwner);
    _grantRole(minter, msg.sender);
    _name = name_;
    _symbol = symbol_;
  }

  /**
    * @dev See {IERC721Metadata-name}.
    */
  function name() public view virtual override returns (string memory) {
    return _name;
  }

  /**
    * @dev See {IERC721Metadata-symbol}.
    */
  function symbol() public view virtual override returns (string memory) {
    return _symbol;
  }

  /**
    * @dev See {IERC721Metadata-tokenURI}.
    */
  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    require(_owners[tokenId] != address(0), "ERC721Metadata: URI query for nonexistent token");
    return _tokenURIs[tokenId];
  }

  /**
    * @dev mint new token
    */ 
  function mint(address to, string memory _tokenURI) virtual override external returns (uint256) {
    require(hasRole(minter, msg.sender), "ERC721: you are not owner");
    require(to != address(0), "ERC721: mint to the zero address");

    uint256 newTokenId = ++(_tokenId);
    _balances[to] += 1;
    _owners[newTokenId] = to;
    _tokenURIs[newTokenId] = _tokenURI;

    emit Transfer(address(0), to, newTokenId);

    return newTokenId;
  }

  /**
    * @dev See {IERC721-balanceOf}.
    */
  function balanceOf(address owner) public view virtual override returns (uint256) {
    require(owner != address(0), "ERC721: balance query for the zero address");
    return _balances[owner];
  }

  /**
    * @dev See {IERC721-ownerOf}.
    */
  function ownerOf(uint256 tokenId) public view virtual override returns (address) {
    address owner = _owners[tokenId];
    require(owner != address(0), "ERC721: owner query for nonexistent token");
    return owner;
  }

  /**
    * @dev See {IERC721-approve}.
    */
  function approve(address spender, uint256 tokenId) public virtual override {
    address owner = _owners[tokenId];

    require(spender != owner, "ERC721: approval to current owner");
    require(msg.sender == owner || _operatorApprovals[owner][msg.sender] || msg.sender == _tokenApprovals[tokenId],
            "ERC721: approve caller is not owner nor approved for all");

    _tokenApprovals[tokenId] = spender;

    emit Approval(owner, spender, tokenId);
  }

  /**
    * @dev See {IERC721-getApproved}.
    */
  function getApproved(uint256 tokenId) public view virtual override returns (address) {
    require(_owners[tokenId] != address(0), "ERC721: approved query for nonexistent token");

    return _tokenApprovals[tokenId];
  }

  /**
    * @dev See {IERC721-setApprovalForAll}.
    */
  function setApprovalForAll(address operator, bool approved) public virtual override {
    require(msg.sender != operator, "ERC721: approve to caller");
    _operatorApprovals[msg.sender][operator] = approved;
    emit ApprovalForAll(msg.sender, operator, approved);
  }

  /**
    * @dev See {IERC721-isApprovedForAll}.
    */
  function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
    return _operatorApprovals[owner][operator];
  }

  /**
    * @dev See {IERC721-transferFrom}.
    */
  function transferFrom(address from, address to, uint256 tokenId) public virtual override {
    //solhint-disable-next-line max-line-length
    require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");

    _transfer(from, to, tokenId);
  }

  /**
    * @dev See {IERC721-safeTransferFrom}.
    */
  function safeTransferFrom(address from, address to, uint256 tokenId) public virtual override {
    safeTransferFrom(from, to, tokenId, "");
  }

  /**
    * @dev See {IERC721-safeTransferFrom}.
    */
  function safeTransferFrom(
    address from,
    address to,
    uint256 tokenId,
    bytes memory data
  ) public virtual override {
    require(_isApprovedOrOwner(msg.sender, tokenId), "ERC721: transfer caller is not owner nor approved");
    _safeTransfer(from, to, tokenId, data);
  }

  /**
    * @dev Safely transfers `tokenId` token from `from` to `to`, checking first that contract recipients
    * are aware of the ERC721 protocol to prevent tokens from being forever locked.
    *
    * `data` is additional data, it has no specified format and it is sent in call to `to`.
    *
    * This internal function is equivalent to {safeTransferFrom}, and can be used to e.g.
    * implement alternative mechanisms to perform token transfer, such as signature-based.
    *
    * Requirements:
    *
    * - `from` cannot be the zero address.
    * - `to` cannot be the zero address.
    * - `tokenId` token must exist and be owned by `from`.
    * - If `to` refers to a smart contract, it must implement {IERC721Receiver-onERC721Received}, which is called upon a safe transfer.
    *
    * Emits a {Transfer} event.
    */
  function _safeTransfer(
    address from,
    address to,
    uint256 tokenId,
    bytes memory data
  ) internal virtual {
    _transfer(from, to, tokenId);
    require(_checkOnERC721Received(from, to, tokenId, data), "ERC721: transfer to non ERC721Receiver implementer");
  }

  /**
    * @dev Transfers `tokenId` from `from` to `to`.
    *  As opposed to {transferFrom}, this imposes no restrictions on msg.sender.
    *
    * Requirements:
    *
    * - `to` cannot be the zero address.
    * - `tokenId` token must be owned by `from`.
    *
    * Emits a {Transfer} event.
    */
  function _transfer(
    address from,
    address to,
    uint256 tokenId
  ) internal virtual {
    require(to != address(0), "ERC721: transfer to the zero address");

    // Clear approvals from the previous owner
    approve(address(0), tokenId);

    _balances[from] -= 1;
    _balances[to] += 1;
    _owners[tokenId] = to;

    emit Transfer(from, to, tokenId);
  }

  /**
    * @dev Returns whether `spender` is allowed to manage `tokenId`.
    *
    * Requirements:
    *
    * - `tokenId` must exist.
    */
  function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual returns (bool) {
    require(_owners[tokenId] != address(0), "ERC721: operator query for nonexistent token");
    address owner = _owners[tokenId];
    return (spender == owner || isApprovedForAll(owner, spender) || getApproved(tokenId) == spender);
  }

  /**
    * @dev Internal function to invoke {IERC721Receiver-onERC721Received} on a target address.
    * The call is not executed if the target address is not a contract.
    *
    * @param from address representing the previous owner of the given token ID
    * @param to target address that will receive the tokens
    * @param tokenId uint256 ID of the token to be transferred
    * @param data bytes optional data to send along with the call
    * @return bool whether the call correctly returned the expected magic value
  */
  function _checkOnERC721Received(
    address from,
    address to,
    uint256 tokenId,
    bytes memory data
  ) private returns (bool) {
    if (to.isContract()) {
      try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
        return retval == IERC721Receiver.onERC721Received.selector;
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
      interfaceId == type(IERC721).interfaceId ||
      interfaceId == type(IERC721Metadata).interfaceId ||
      super.supportsInterface(interfaceId);
    }
    

}