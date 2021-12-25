// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0; // tell truffle which solidity version to use

// we can also write imports outside the 'contract' block, all other aspects of the smart contract goes inside the 'contract' block
import "../../node_modules/openzeppelin-solidity/contracts/utils/math/SafeMath.sol";

contract Token {
    using SafeMath for uint;

    string public name = "burghir"; // public is a keyword to change visibility of the variable to public. This means that this variable will be accessible even outside the scope of this contract.
    string public symbol = "BURG";
    uint256 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf; // similar to map in C++, address is a data type that literallly represents an ethereum address, mapping to track balances 
    mapping(address => mapping(address => uint256)) public allowance; // keeps track of how many tokens the exchange is allowed to spend
    // the outer mapping address represents the address of the person who approves the exchange, and the nested (inner) mapping address represents the exchange that has been approved to spend the amount

    // Events
    event Transfer(address indexed _from, address indexed _to, uint256 _value);
    event Approval(address indexed _owner, address indexed _spender, uint256 _value);

    // the constructor is a special function that runs when the contract is deployed to the blockchain (i.e., when the contract is initialized for the first time)
    constructor() { // constructors have to have a public keyword in order to work (will work even without public these days, since public is now default behaviour for constructors in solidity)
        totalSupply = 1000000 * (10 ** decimals);
        balanceOf[msg.sender] = totalSupply; // msg.sender refers to the person (address) who called the function. Since this is a constructor, the msg.sender for this function would be the person who deployed the contract, i.e. the owner of the contract.
    }

    function transfer(address _to, uint256 _value) public returns (bool success) { // the interface for this function should be exactly the same as the one provided in ERC20 standard
        require(balanceOf[msg.sender] >= _value);
        _transfer(msg.sender, _to, _value); 
        return true;
    }

    function _transfer(address _from, address _to, uint256 _value) internal { // internal is a visibility modifier like public or private. 'internal' allows the function to be accessed outside the contract BU only by the contract that inherit from this contract.
        require(_to != address(0)); // address(0) denotes the zero address (invalid address)
        balanceOf[_from] = balanceOf[_from].sub(_value); // the sender would obviously be the person who called this function, so, sender is msg.sender
        balanceOf[_to] = balanceOf[_to].add(_value);
        emit Transfer(_from, _to, _value);
    }

    // Approve tokens (allow someone to spend our tokens)
    function approve(address _spender, uint _value) public returns (bool success) {
        require(_spender != address(0));
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    // Transfer from
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool success) {
        require(_value <= balanceOf[_from]);
        require(_value <= allowance[_from][msg.sender]); // ensures that the exchange (msg.sender in this case, since the exchange is the one calling the function) is actually approved by the sender as well as that it cannot spend more coins that allowed
        // adjust the allowance after transfer happens so same tokens cannot be sent repeatedly
        allowance[_from][msg.sender] = allowance[_from][msg.sender].sub(_value);
        _transfer(_from, _to, _value);
        return true;
    }
}