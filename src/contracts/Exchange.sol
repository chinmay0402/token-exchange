// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import "./Token.sol";
import "../../node_modules/openzeppelin-solidity/contracts/utils/math/SafeMath.sol";

// TODO:
// [X] Set the fee account
// [X] Deposit Ether
// [X] Withdraw Ether
// [X] Deposit tokens
// [X] Withdraw tokens
// [X] Check balances
// [X] Make order
// [X] Cancel order
// [X] Fill order
// [X] Charge fees

contract Exchange{
    using SafeMath for uint256;

    // Variables
    address public feeAccount; // the account that recieves exchange fee, since this is a public state variable EVM will get a method to access this method out-of-the-box
    uint256 public feePercent;
    address constant ETHER = address(0); // helps store Ether in tokens mapping with blank address
    mapping(address => mapping(address => uint256)) public tokens; // mapping for the exchange which for each token (address in the outer mapping), the users who have deposited them (the address in nested/inner mapping) along with the amount
    // we even keep track of each user's Ether on the exchange in the above mapping. Since Ether does not have an address, we will assu 

    mapping(uint256 => _Order) public orders;
    uint256 public orderCount; // keeps track of total number of orders till now so that we can set id in _Order

    mapping(uint256 => bool) public orderCancelled;
    mapping(uint256 => bool) public orderFilled;

    // Events
    event Deposit(
        address _token, 
        address _user, 
        uint256 _amount, 
        uint256 _balance
    );
    event Withdraw(
        address _token,
        address _user, 
        uint256 _amount, 
        uint256 _balance
    );
    event Order(
        uint256 _id,
        address _user,
        address _tokenGet,
        uint256 _amountGet,
        address _tokenGive,
        uint256 _amountGive,
        uint256 _timestamp
    );
    event Cancel(
        uint256 _id,
        address _user,
        address _tokenGet,
        uint256 _amountGet,
        address _tokenGive,
        uint256 _amountGive,
        uint256 _timestamp
    );
    event Trade(
        uint256 _id,
        address _user,
        address _tokenGet,
        uint256 _amountGet,
        address _tokenGive,
        uint256 _amountGive,
        address _userFill,
        uint256 _timestamp
    );


    struct _Order { // named this with an underscore to avoid conflict with the Order event
        uint256 id;
        address user;
        address tokenGet;
        uint256 amountGet;
        address tokenGive;
        uint256 amountGive;
        uint256 timestamp;
    }

    // a way to store the order
    // add the order to storage

    constructor(address _feeAccount, uint256 _feePercent) { // it is convention to start parameter naming with underscore to differentiate between function scope and global scope variables
        feeAccount = _feeAccount;
        feePercent = _feePercent;
    }

    /**
    * @dev reverts if Ether is sent to this smart contract by mistake
    */
    receive() external payable {
        revert();
    }

    /**
    * @dev allows user to deposit Ether with the exchange (with the help of the payable modifier)
    */
    function depositEther() payable public {
        tokens[ETHER][msg.sender] = tokens[ETHER][msg.sender].add(msg.value);
        emit Deposit(ETHER, msg.sender, msg.value, tokens[ETHER][msg.sender]);
    }

    function withdrawEther(uint _amount) public {
        require(tokens[ETHER][msg.sender] >= _amount);
        tokens[ETHER][msg.sender] = tokens[ETHER][msg.sender].sub(_amount);
        payable(msg.sender).transfer(_amount);
        emit Withdraw(ETHER, msg.sender, _amount, tokens[ETHER][msg.sender]);
    } 

    /** 
    * @dev allows user to deposit a token with the exchange
    * @param _token address of the ERC20 token to be used by exchange
    * @param _amount the amount of _token to be deposited
    */
    function depositToken(address _token, uint256 _amount) public {
        require(_token != ETHER); // ensures that depositToken does not allow any Ether deposits (since we have a separate function for that)
        require(Token(_token).transferFrom(msg.sender, address(this), _amount)); // creates an instance of this token on the Ethereum network, address(this) represents the address of the current contract (i.e. Exchange.sol)
        // we put the transferFrom call inside a require because we want to continue execution only when the transfer of tokens to the exchange is successful, otherwise we want to stop

        tokens[_token][msg.sender] = tokens[_token][msg.sender].add(_amount);
        emit Deposit(_token, msg.sender, _amount, tokens[_token][msg.sender]);
    }

    function withdrawToken(address _token, uint256 _amount) public {
        require(_token != ETHER);
        require(tokens[_token][msg.sender] >= _amount);
        tokens[_token][msg.sender] = tokens[_token][msg.sender].sub(_amount);
        require(Token(_token).transfer(msg.sender, _amount));
        emit Withdraw(_token, msg.sender, _amount, tokens[_token][msg.sender]);
    }

    /**
    * @dev returns the amount of _tokens the _user has kept with the exchange 
    */
    function balanceOf(address _token, address _user) public view returns (uint256) { // view means no writes are made to the blockchain, so this function does not consume any gas
        return tokens[_token][_user];
    } 

    /**
    * @dev creates an order on the blockchain
    */
    function makeOrder(address _tokenGet, uint256 _amountGet, address _tokenGive, uint256 _amountGive) public {
        orderCount = orderCount.add(1);
        orders[orderCount] = _Order(orderCount, msg.sender, _tokenGet, _amountGet, _tokenGive, _amountGive, block.timestamp);
        emit Order(orderCount, msg.sender, _tokenGet, _amountGet, _tokenGive, _amountGive, block.timestamp);
    }

    function cancelOrder(uint256 _id) public {
        _Order storage _order = orders[_id];
        // must be the order of the user who calls the function
        require(_order.user == msg.sender);
        
        // must be a valid order, and not already fulfilled or cancelled
        require(_order.id == _id);
        require(!orderCancelled[_id]);
        require(!orderFilled[_id]);

        orderCancelled[_id] = true;
        emit Cancel(_id, msg.sender, _order.tokenGet, _order.amountGet, _order.tokenGive, _order.amountGive, block.timestamp);
    }

    /**
    * @dev completes the pending order (give order.user amountGet number of tokenGet tokens from  msg.sender in exchange for amountGive number of tokenGive tokens)
    * @param _id the id of the pending order msg.sender wants to fill 
     */
    function fillOrder(uint256 _id) public {
        require(_id > 0 && _id <= orderCount); // check if the order is valid
        
        // check to see if the order is not already fulfilled (or cancelled)
        require(!orderCancelled[_id]);
        require(!orderFilled[_id]);

        // fetch the order from storage
        _Order storage _order = orders[_id];
        // execute the trade (call the trade function)
        _trade(_order.id, _order.user, _order.tokenGet, _order.amountGet, _order.tokenGive, _order.amountGive);
        orderFilled[_order.id] = true;
    }

    /**
    @dev internal function which executes the token trade
    * @param _orderId the id of the order that the function is completing
    * @param _user the user who has placed the order (different from the person who fills the order, which will be msg.sender)
    * @param _tokenGet the type of token the user wants
    * @param _amountGet the amount of _tokenGet tokens the user wants
    * @param _tokenGive the type of token user is offering in exchange for _tokenGet tokens
    * @param _amountGive the amount of _tokenGive tokens the user is willing to give
     */
    function _trade(uint256 _orderId, address _user, address _tokenGet, uint256 _amountGet, address _tokenGive, uint256 _amountGive ) internal {
        // Fee is paid by the user that fills the order, a.k.a msg.sender.
        // Fee is deducted from _amountGet
        uint256 _feeAmount = _amountGive.mul(feePercent).div(100);
        // execute the trade
        tokens[_tokenGet][msg.sender] = tokens[_tokenGet][msg.sender].sub(_amountGet.add(_feeAmount)); // msg.sender is the address of the person filling the order
        tokens[_tokenGet][_user] = tokens[_tokenGet][_user].add(_amountGet); // _user is the person who wants to make the order
        tokens[_tokenGet][feeAccount] = tokens[_tokenGet][feeAccount].add(_feeAmount); // put transaction fee in feeAccount
        tokens[_tokenGive][_user] = tokens[_tokenGive][_user].sub(_amountGive);
        tokens[_tokenGive][msg.sender] = tokens[_tokenGive][msg.sender].add(_amountGive);

        // emit Trade event
        emit Trade(_orderId, _user, _tokenGet, _amountGet, _tokenGive, _amountGive, msg.sender, block.timestamp);
    }

}
