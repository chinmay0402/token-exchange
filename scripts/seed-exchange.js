const Token = artifacts.require("Token");
const Exchange = artifacts.require("Exchange");

const ETHER_ADDRESS = '0x0000000000000000000000000000000000000000';
const EVM_REVERT = 'VM Exception while processing transaction: revert';

const ether = (n) => {
    return new web3.utils.BN(
        web3.utils.toWei(n.toString(), 'ether')
    )
}

// same as ether
const tokens = (n) => ether(n)


module.exports = async function(callback) {
    try{
        // Fetch accounts from wallet - these are unlocked
        const accounts = await web3.eth.getAccounts();

        // Fetch the deployed token
        const token = await Token.deployed();
        console.log('Token fetched', token.address);

        // Fetch the deployed exchange
        const exchange = await Exchange.deployed();
        console.log('Exchange fetched', exchange.address);

        // Give tokens to account[1]
        const sender = accounts[0];
        const receiver = accounts[1];
        let amount = web3.utils.toWei('10000', 'ether'); // 10,000 tokens

        await token.transfer(receiver, amount, { from: sender });
        console.log(`Transferred ${amount} tokens from ${sender} to ${receiver}`);

        // Set up exchange users
        const user1 = accounts[0];
        const user2 = accounts[1];

        // user1 deposits ether 
        amount = 1;
        await exchange.depositEther({ from: user1, value: ether(amount) });
        console.log(`Deposited ${amount} tokens from ${user1}`);

        // user2 approves tokens
        amount = 10000
        await token.approve(exchange.address, tokens(amount), { from: user2 });
        console.log(`Approved ${amount} tokens from ${user2}`);

        // user2 deposits tokens
        await exchange.depositToken(token.address, tokens(amount), { from: user2 });
        console.log(`Deposited ${amount} tokens from ${user2}`);

        ////////////////////////////////////////////////////////////////////////
        // Seed a cancelled order
        // user1 makes order to get tokens
        let result;
        let orderId;
        result = await exchange.makeOrder(token.address, tokens(100), ETHER_ADDRESS, ether(0.1), { from: user1 });
        console.log(`Made order from ${user1}`);

        // user1 cancels order
        orderId = result.logs[0].args._id;
        await exchange.cancelOrder(orderId, { from: user1 });
        console.log(`Cancelled order from ${user1}`);

        ////////////////////////////////////////////////////////////////////////
        // Seed filled orders

        // user1 makes order
        result = await exchange.makeOrder(token.address, tokens(100), ETHER_ADDRESS, ether(0.1), { from: user1 });
        console.log(`Made order from ${user1}`);
        
        // user2 fills order
        orderId = result.logs[0].args._id;
        await exchange.fillOrder(orderId, { from: user2 });
        console.log(`Filled order from ${user1}`);

        // wait 1 second (waiting one second to prevent timestamp collisions)
        await new Promise(r => setTimeout(r, 1000));

        // user1 makes another order
        result = await exchange.makeOrder(token.address, tokens(50), ETHER_ADDRESS, ether(0.01), { from: user1 });
        console.log(`Made order from ${user1}`);
        console.log(`Filled order from ${user1}`);

        // user2 fills another order
        orderId = result.logs[0].args._id;
        await exchange.fillOrder(orderId, { from: user2 });

        // wait 1 second
        await new Promise(r => setTimeout(r, 1000));

        // user1 makes final order
        result = await exchange.makeOrder(token.address, tokens(200), ETHER_ADDRESS, ether(0.15), { from: user1 });
        console.log(`Made order from ${user1}`);

        // user2 fills final order
        orderId = result.logs[0].args._id;
        await exchange.fillOrder(orderId, { from: user2 });
        console.log(`Filled order from ${user1}`);

        ////////////////////////////////////////////////////////////////////////
        // Seed open orders

        // user1 makes 10 orders 
        for(let i = 1; i <= 10; i++){
            result = await exchange.makeOrder(token.address, tokens(10*i), ETHER_ADDRESS, ether(0.01), { from: user1 });
            console.log(`Made order from ${user1}`);
            // wait 1 second
            await new Promise(r => setTimeout(r, 1000));
        }

        // user2 makes 10 orders 
        for(let i = 1; i <= 10; i++){
            result = await exchange.makeOrder(ETHER_ADDRESS, ether(0.01), token.address, tokens(10*i), { from: user2 });
            console.log(`Made order from ${user2}`);
            // wait 1 second
            await new Promise(r => setTimeout(r, 1000)); // equivalent to sleep 1
        }

    }
    catch(error){
        console.log(error)
    }
    callback();
}