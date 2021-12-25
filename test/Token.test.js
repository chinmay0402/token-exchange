import { tokens, EVM_REVERT } from './helpers';

const Token = artifacts.require('./Token')

require('chai')
    .use(require('chai-as-promised'))
    .should()

contract('Token', ([deployer, reciever, exchange]) => { // this callback function injects all the accounts using the contract into our function (so deployer, reciever, exchange, etc. are simple account indexes 0, 1, 2 of the accounts array)
    const name = 'burghir';
    const symbol = 'BURG';
    const decimals = '18';
    const totalSupply = tokens(1000000).toString();
    let token

    beforeEach( async () => { // runs the code in this before calling every describe('') 
        // Fetch contract from blockchain
        token = await Token.new();
    })

    describe('deployment', () => {
        it('tracks the name', async () => {
            // Read token name here
            const result = await token.name();
            // Check if the token name is 'burghir'
            result.should.equal(name);
        })

        it('tracks the symbol', async () => {
            const result = await token.symbol();
            result.should.equal(symbol);
        })

        it('tracks the decimals', async () => {  
            const result = await token.decimals();
            result.toString().should.equal(decimals);
        })

        it('tracks the total supply', async () => {
            const result = await token.totalSupply();
            result.toString().should.equal(totalSupply.toString());
        })

        it('assigns the total supply to the deployer', async() => {
            const result = await token.balanceOf(deployer); // accounts[0] denotes the account of the deployer (since it is the first account using the contract)
            result.toString().should.equal(totalSupply.toString())
        })
    }) // set of tests for checking if deployment was done correctly

    describe('sending tokens', () => {
        let result;
        let amount;

        describe('success', async () => {
            beforeEach(async () => {
                amount = tokens(100)
                result = await token.transfer(reciever, amount, {from: deployer});
            })
    
            it('transfers token balances', async () => {
                let balanceOf;
    
                balanceOf = await token.balanceOf(deployer);
                balanceOf.toString().should.equal(tokens(999900).toString());
                // console.log("deployer balance after transfer", balanceOf.toString());
                balanceOf = await token.balanceOf(reciever);
                balanceOf.toString().should.equal(tokens(100).toString());
                // console.log("reciever balance after transfer", balanceOf.toString());
            })
    
            it('emits a transfer event', async () => {
                const log = result.logs[0];
                log.event.should.equal('Transfer');
                const event = log.args;
                event._from.toString().should.eq(deployer, 'from is correct');
                event._to.toString().should.eq(reciever, 'to is correct');
                event._value.toString().should.eq(amount.toString(), 'value is correct');
            })
        }) // set of tests for checking if (valid) transfer occurred correctly

        describe('failure', () => {
            it('rejects insufficient balances', async () => {
                let invalidAmount;
                invalidAmount = tokens(100000000) // 100 million - greater than total supply
                await token.transfer(reciever, invalidAmount, {from: deployer}).should.be.rejectedWith(EVM_REVERT);

                // Attempt to transfer tokens when you have none should fail
                invalidAmount = tokens(10);
                await token.transfer(deployer, invalidAmount, {from: reciever}).should.be.rejectedWith(EVM_REVERT);
            })

            it('rejects invalid recipients', async () => {
                await token.transfer(0x0, amount, {from: deployer}).should.be.rejected;
            })
        }) // set of tests to see if invalid transactions fail
        
    }) // set of tests for token transactions

    describe('approving tokens', () => {
        let result;
        let amount;

        beforeEach(async () => {
            amount = tokens(100);
            result = await token.approve(exchange, amount, {from: deployer}); // approves exchange to spend 'amount' tokens of the deployer
        })

        describe('success', () => {
            it('allocates an allowance for delegated token spending on exchange', async () => {
                const allowance = await token.allowance(deployer, exchange);
                allowance.toString().should.equal(amount.toString()); // checks if the amount the exchange was finally allowed to spend is actually equal to the amount we (the deployer) wanted to
            })

            it('emits an Approval event', async () => {
                const log = result.logs[0];
                log.event.should.eq('Approval');
                const event = log.args;
                event._owner.toString().should.eq(deployer, 'owner is correct');
                event._spender.toString().should.eq(exchange, 'spender is correct');
                event._value.toString().should.eq(amount.toString(), 'value is correct');
            })
        })

        describe('failure', () => {
            it('rejects invalid spenders', async () => {
                await token.approve(0x0, amount, {from: deployer}).should.be.rejected;
            })
        })
    })

    describe('delegated token transfers', () => {
        let result;
        let amount;

        beforeEach(async () => {
            amount = tokens(100);
            await token.approve(exchange, amount, {from: deployer});
        })

        describe('success', async () => {
            beforeEach(async () => {
                amount = tokens(100)
                result = await token.transferFrom(deployer, reciever, amount, {from: exchange}); // transfer from deployer to reciever and the exchange will do the transfer
            })
    
            it('transfers token balances', async () => {
                let balanceOf;
                balanceOf = await token.balanceOf(deployer);
                balanceOf.toString().should.equal(tokens(999900).toString());
                balanceOf = await token.balanceOf(reciever);
                balanceOf.toString().should.equal(tokens(100).toString());
            })
    
            it('resets the allowance', async () => {
                const allowance = await token.allowance(deployer, exchange);
                allowance.toString().should.equal('0'); // checks if the amount the exchange was finally allowed to spend is actually equal to the amount we (the deployer) wanted to
            })

            it('emits a transfer event', async () => {
                const log = result.logs[0];
                log.event.should.equal('Transfer');
                const event = log.args;
                event._from.toString().should.eq(deployer, 'from is correct');
                event._to.toString().should.eq(reciever, 'to is correct');
                event._value.toString().should.eq(amount.toString(), 'value is correct');
            })
        })

        describe('failure', () => {
            it('rejects insufficient balances', async () => {
                let invalidAmount;
                invalidAmount = tokens(100000000) // 100 million - greater than total supply
                // attempt to transfer too many tokens
                await token.transferFrom(deployer, reciever, invalidAmount, {from: exchange}).should.be.rejectedWith(EVM_REVERT);
            })

            it('rejects invalid recipients', async () => {
                await token.transferFrom(deployer, 0x0, amount, {from: exchange}).should.be.rejected;
            })
        }) 
        
    })
})