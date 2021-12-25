import { tokens, EVM_REVERT, ETHER_ADDRESS, ether } from './helpers';

const Token = artifacts.require('./Token')
const Exchange = artifacts.require('./Exchange');

require('chai')
    .use(require('chai-as-promised'))
    .should()

contract('Exchange', ([deployer, feeAccount, user1, user2]) => {
    let token;
    let exchange;
    const feePercent = 10;

    beforeEach(async () => {
        // Deploy token
        token = await Token.new();
        
        // Transfer some tokens to user1 to further testing
        token.transfer(user1, tokens(100), { from: deployer }); 

        // Deploy the exchange
        exchange = await Exchange.new(feeAccount, feePercent); // passess feeAccount as a parameter to the Exchange contracts constructor
    })

    describe('deployment',() => {
        it('tracks the fee account', async () => {
            const result = await exchange.feeAccount();
            result.should.eq(feeAccount);
        })

        it('tracks the fee percentage', async () => {
            const result = await exchange.feePercent();
            result.toString().should.eq(feePercent.toString()); // we always use toString() for any number comparisons so that we don't get errors for comparing normal uints to BNs (or any other cross-type conversion)
        })
    })

    describe('fallback', () => {
        it('reverts when Ether is sent', async () =>{
            await exchange.depositEther({value: 1, from: user1 });
        })
    })

    describe('depositing tokens', () => {
        let result;
        let amount;

        describe('success', () => {

            beforeEach(async () => { // to approve the exchange to spend/manage tokens of the user first
                amount = tokens(10);
                await token.approve(exchange.address, amount, { from: user1 }); // exchage.address represents the address of the exchange
                result = await exchange.depositToken(token.address, tokens(10), { from: user1 });
            })

            it('tracks the token deposit', async () => {
                // Check exchange token balance
                let balance;
                balance = await token.balanceOf(exchange.address);
                balance.toString().should.eq(amount.toString());
                balance = await exchange.tokens(token.address, user1);
                balance.toString().should.eq(amount.toString()); // we could check with amount this time too since 'amount' if the number of tokens transferred to the exchange
            })

            it('emits a Deposit event', async () => {
                // Check exchange token balance
                const log = result.logs[0]
                log.event.should.eq('Deposit');
                const event = log.args;
                event._token.should.eq(token.address, 'token address is correct');
                event._user.should.eq(user1, 'user address is correct');
                event._amount.toString().should.eq(tokens(10).toString(), 'amount is correct');
                event._balance.toString().should.eq(tokens(10).toString(), 'balance is correct');
            })

        })

        describe('failure', () => {
            it('rejects Ether deposits', async () => {
                await exchange.depositToken(ETHER_ADDRESS, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT);
            })
            it('fails when no tokens are approved', async () => {
                // attepmt to deposit tokens without approving
                await exchange.depositToken(token.address, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT);
            })
        })
    })

    describe('withdrawing tokens', async () => {
        let result;
        let amount;

        describe('success', () => {
            beforeEach(async () => {
                amount = tokens(10);
                await token.approve(exchange.address, amount, { from: user1 }); // approve exchange to spend tokens
                await exchange.depositToken(token.address, amount, { from: user1 }); // deposit tokens to exchange's account 

                result = await exchange.withdrawToken(token.address, amount, { from: user1 }); // withdraw tokens
            })

            it('withdraws token funds', async () => {
                const balance = await exchange.tokens(token.address, user1);
                balance.toString().should.eq('0');
            })

            it('emits Withdraw event', async () => {
                const log = result.logs[0];
                log.event.should.eq('Withdraw');
                const event = log.args;
                event._token.should.eq(token.address);
                event._user.should.eq(user1);
                event._amount.toString().should.eq(amount.toString());
                event._balance.toString().should.eq('0');
            })
        })

        describe('failure', () => {
            it('reject Ether withdraws', async () => {
                await exchange.depositToken(ETHER_ADDRESS, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT);
            })

            it('fails for insufficient balances', async () => {
                await exchange.depositToken(token.address, tokens(10), { from: user1 }).should.be.rejectedWith(EVM_REVERT);
            })
        })
    })

    describe('depositing Ether', () => {
        let result;
        let amount;
        
        beforeEach(async() => {
            amount = ether(1)
            result = await exchange.depositEther({ from: user1, value: amount });
        })

        it('tracks Ether deposit', async () => {
            const balance = await exchange.tokens(ETHER_ADDRESS, user1);
            balance.toString().should.eq(amount.toString());
        })

        it('emits a Deposit event', async () => {
            // Check exchange token balance
            const log = result.logs[0]
            log.event.should.eq('Deposit');
            const event = log.args;
            event._token.should.eq(ETHER_ADDRESS, 'ether address is correct');
            event._user.should.eq(user1, 'user address is correct');
            event._amount.toString().should.eq(amount.toString(), 'amount is correct');
            event._balance.toString().should.eq(amount.toString(), 'balance is correct');
        })
    })

    describe('withdrawing Ether', () => {
        let result;
        let amount;

        beforeEach(async () => { // beforeEach -> runs before each nesting in the level immediately after (i.e. both 'success' and 'failure' describes in our case)
            // Deposit Ether first
            amount = ether(1)
            result = await exchange.depositEther({ from: user1, value: amount });
        })

        describe('success', () => {
            beforeEach(async () => {
                // Withdraw Ether
                result = await exchange.withdrawEther(amount, { from: user1 });
            })

            it('withdraws ether funds', async () => {
                const balance = await exchange.tokens(ETHER_ADDRESS, user1);
                balance.toString().should.equal('0');
            })

            it('emits a Withdraw event', async () => {
                const log = result.logs[0];
                log.event.should.eq('Withdraw');
                const event = log.args;
                event._token.should.eq(ETHER_ADDRESS);
                event._user.should.eq(user1);
                event._amount.toString().should.eq(amount.toString());
                event._balance.toString().should.eq('0');
            })
        })

        describe('failure', () => {
            it('rejects withdrawals insufficient balances', async () => {
                // attempt to withdraw more amount than we actually deposited
                await exchange.withdrawEther(ether(100), { from: user1 }).should.be.rejectedWith(EVM_REVERT);
            })
        })
    })

    describe('check balances', () => {

        describe('check ether balance', () => {
            beforeEach(async () => {
                await exchange.depositEther({ from: user1, value: ether(1) });
            })

            it("returns user's ether balance", async () => {
                const result = await exchange.balanceOf(ETHER_ADDRESS, user1);
                result.toString().should.eq(ether(1).toString());
            })
        })

        describe('check token balance', () => {
            beforeEach(async () => {
                let amount = tokens(10);
                // approve address to access the tokens
                await token.approve(exchange.address, amount, { from: user1 }); 

                // transfer tokens to address
                await exchange.depositToken(token.address, amount, { from: user1 });
            })

            it("returns user's token balance", async () => {
                const result = await exchange.balanceOf(token.address, user1);
                result.toString().should.eq(tokens(10).toString());
            })
        })    
    })

    describe('making orders', () => {
        let result;

        beforeEach(async () => {
            result = await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), { from: user1 });
        })

        it('tracks the newly created order', async () => {    
            const orderCount = await exchange.orderCount(); 
            orderCount.toString().should.eq('1');
            const order = await exchange.orders(1);
            order.id.toString().should.eq('1', 'id is correct');
            order.user.should.eq(user1, 'user is correct');
            order.tokenGet.should.eq(token.address, 'tokenGet is correct');
            order.amountGet.toString().should.eq(ether(1).toString(), 'amountGet is correct');
            order.tokenGive.should.eq(ETHER_ADDRESS, 'tokenGive is correct');
            order.amountGive.toString().should.eq(ether(1).toString(), 'amountGive is correct');
            order.timestamp.toString().length.should.be.at.least(1, 'timestamp is correct');
        })

        it('emits Order event', async () => {
            const log = result.logs[0];
            log.event.should.eq('Order');
            const event = log.args;
            event._id.toString().should.eq('1');
            event._tokenGet.should.eq(token.address);
            event._amountGet.toString().should.eq(tokens(1).toString());
            event._tokenGive.should.eq(ETHER_ADDRESS);
            event._amountGive.toString().should.eq(ether(1).toString());
            event._timestamp.toString().length.should.be.at.least(1);
        })
    })

    describe('order actions', () => {
        
        beforeEach(async () => {
            // user1 deposits ether only
            await exchange.depositEther({ from: user1, value: ether(1) });
            // give tokens to user2
            await token.transfer(user2, tokens(100), { from: deployer });
            // user2 deposits tokens only
            await token.approve(exchange.address, tokens(2), { from: user2 });
            await exchange.depositToken(token.address, tokens(2), { from:user2 });
            // user1 makes an order to buy tokens with ether
            await exchange.makeOrder(token.address, tokens(1), ETHER_ADDRESS, ether(1), { from: user1 });
        })

        describe('filling orders', () => {
            let result;
            
            describe('success', () => {
                beforeEach(async () => {
                    // user2 fills order
                    result = await exchange.fillOrder('1', { from: user2 });
                })

                it('executes trade and charges fees', async () => {
                    let balance;
                    balance = await exchange.balanceOf(token.address, user1);
                    balance.toString().should.eq(tokens(1).toString(), 'user1 received tokens');
                    balance = await exchange.balanceOf(ETHER_ADDRESS, user2);
                    balance.toString().should.eq(ether(1).toString(), 'user2 received Ether');
                    balance = await exchange.balanceOf(ETHER_ADDRESS, user1);
                    balance.toString().should.eq('0', 'user1 Ether deducted');
                    balance = await exchange.balanceOf(token.address, user2);
                    balance.toString().should.eq(tokens(0.9).toString(), 'user2 tokens deducted with fee applied');
                    balance = await exchange.balanceOf(token.address, feeAccount);
                    balance.toString().should.eq(tokens(0.1).toString(), 'feeAccount received fee')
                })

                it('updates filled orders', async () => {
                    const orderFilled = await exchange.orderFilled(1);
                    orderFilled.should.eq(true);
                })

                it('emits Trade event', async () => {
                    const log = result.logs[0];
                    log.event.should.eq('Trade');
                    const event = log.args;
                    event._id.toString().should.eq('1', 'id is correct');
                    event._user.should.eq(user1, 'user is correct');
                    event._tokenGet.should.eq(token.address, 'tokenGet is correct');
                    event._amountGet.toString().should.eq(tokens(1).toString(), 'amountGet is correct');
                    event._tokenGive.should.eq(ETHER_ADDRESS, 'tokenGive is correct');
                    event._amountGive.toString().should.eq(ether(1).toString(), 'amountGive is correct');
                    event._userFill.should.eq(user2, 'userFill is correct');
                    event._timestamp.toString().length.should.be.at.least(1, 'timestamp is correct');
                })
            })

            describe('failure', () => {
                it('rejects invalid order ids', async () => {
                    const invalidOrderId = 99999;
                    await exchange.fillOrder(invalidOrderId, { from: user2 }).should.be.rejectedWith(EVM_REVERT);
                })

                it('rejects already-filled orders', async () => {
                    // Fill the order
                    await exchange.fillOrder('1', { from: user2 }).should.be.fulfilled;
                    // Try to fill it again
                    await exchange.fillOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT);
                })

                it('rejects cancelled orders', async () => {
                    // Cancel the order
                    await exchange.cancelOrder('1', { from: user1 }).should.be.fulfilled;
                    // Try to fill this order
                    await exchange.fillOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT);
                })
            })
        })

        describe('cancelling orders', async () => {
            let result;

            describe('success', async () => {
                beforeEach(async () => {
                    // try to cancel order
                    result = await exchange.cancelOrder('1', { from: user1 });
                })

                it('updates cancelled orders', async () => {
                    // check if the order with id '1' is now present in the orderCancelled mapping (which would mean that it was cancelled)
                    const orderCancelled = await exchange.orderCancelled(1);
                    orderCancelled.should.eq(true);
                })

                it('emits Cancel event', async () => {
                    const log = result.logs[0];
                    log.event.should.eq('Cancel');
                    const event = log.args;
                    event._id.toString().should.eq('1');
                    event._tokenGet.should.eq(token.address);
                    event._amountGet.toString().should.eq(tokens(1).toString());
                    event._tokenGive.should.eq(ETHER_ADDRESS);
                    event._amountGive.toString().should.eq(ether(1).toString());
                    event._timestamp.toString().length.should.be.at.least(1);    
                })
            })

            describe('failure', () => {
                it('rejects invalid order', async () => {
                    const invalidOrderId = 99999;
                    await exchange.cancelOrder(invalidOrderId, { from: user1 }).should.be.rejectedWith(EVM_REVERT);
                })

                it('rejects unauthorized cancellations', async () => {
                    // Try to cancel the order from another user
                    await exchange.cancelOrder('1', { from: user2 }).should.be.rejectedWith(EVM_REVERT);
                })
            })
        })
    })

})