/**
 * Test for UacToken
 *
 * @author Validity Labs AG <info@validitylabs.org>
 */

import {expectThrow, getEvents, BigNumber} from '../helpers/tools';
import {logger as log} from '../../../tools/lib/logger';

const UacToken = artifacts.require('./UacToken');

const should = require('chai') // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

/**
 * UacToken contract
 */
contract('UacToken', (accounts) => {
    const owner = accounts[0];
    const tokenHolder1 = accounts[1];
    const tokenHolder2 = accounts[2];
    const tokenHolder3 = accounts[3];

    // Provide UacTokenInstance for every test case
    let uacTokenInstance;
    beforeEach(async () => {
        uacTokenInstance = await UacToken.deployed();
    });

    /**
     * [ Pause Period ]
     */

    it('should instantiate the ICO token correctly', async () => {
        log.info('[ Pause Period ]');

        const isOwnerAccountZero = await uacTokenInstance.owner();
        const name = await uacTokenInstance.name();
        const symbol = await uacTokenInstance.symbol();
        const decimals = await uacTokenInstance.decimals();

        isOwnerAccountZero.should.equal(owner);
        name.should.equal('Ubiatar Coin');
        symbol.should.equal('UAC');
        decimals.should.be.bignumber.equal(18, 'Decimals does not match');
    });

    it('should fail, token can not be transferrable while on paused mode', async () => {
        await expectThrow(uacTokenInstance.transfer(tokenHolder2, 1, {from: tokenHolder1}));

        const balanceTokenHolder2 = await uacTokenInstance.balanceOf(tokenHolder2);
        balanceTokenHolder2.should.be.bignumber.equal(0);
    });

    it('should mint 5 tokens for each token holder', async () => {
        let balanceTokenHolder1 = await uacTokenInstance.balanceOf(tokenHolder1);
        let balanceTokenHolder2 = await uacTokenInstance.balanceOf(tokenHolder2);
        let balanceTokenHolder3 = await uacTokenInstance.balanceOf(tokenHolder3);
        let totalSupply = await uacTokenInstance.totalSupply();

        balanceTokenHolder1.should.be.bignumber.equal(0);
        balanceTokenHolder2.should.be.bignumber.equal(0);
        balanceTokenHolder3.should.be.bignumber.equal(0);
        totalSupply.should.be.bignumber.equal(0);

        const tx1 = await uacTokenInstance.mint(tokenHolder1, 5);
        const tx2 = await uacTokenInstance.mint(tokenHolder2, 5);
        const tx3 = await uacTokenInstance.mint(tokenHolder3, 5);

        balanceTokenHolder1 = await uacTokenInstance.balanceOf(tokenHolder1);
        balanceTokenHolder2 = await uacTokenInstance.balanceOf(tokenHolder2);
        balanceTokenHolder3 = await uacTokenInstance.balanceOf(tokenHolder3);
        totalSupply = await uacTokenInstance.totalSupply();

        balanceTokenHolder1.should.be.bignumber.equal(5);
        balanceTokenHolder2.should.be.bignumber.equal(5);
        balanceTokenHolder3.should.be.bignumber.equal(5);
        totalSupply.should.be.bignumber.equal(15);

        // Testing events
        const events1 = getEvents(tx1);
        const events2 = getEvents(tx2);
        const events3 = getEvents(tx3);

        events1.Mint[0].to.should.equal(tokenHolder1);
        events1.Mint[0].amount.should.be.bignumber.equal(5);
        events1.Transfer[0].value.should.be.bignumber.equal(5);

        events2.Mint[0].to.should.equal(tokenHolder2);
        events2.Mint[0].amount.should.be.bignumber.equal(5);
        events2.Transfer[0].value.should.be.bignumber.equal(5);

        events3.Mint[0].to.should.equal(tokenHolder3);
        events3.Mint[0].amount.should.be.bignumber.equal(5);
        events3.Transfer[0].value.should.be.bignumber.equal(5);
    });

    /**
     * [ Free Period ]
     */
    it('should unpause ICO token correctly', async () => {
        log.info('[ Free period ]');

        await uacTokenInstance.unpause({from: owner});
        const paused = await uacTokenInstance.paused();

        assert.isFalse(paused);
    });

    it('should transfer token from tokenHolder1 to tokenHolder2 using the transfer method', async () => {
        const balanceTokenHolder1 = await uacTokenInstance.balanceOf(tokenHolder1);
        const balanceTokenHolder2 = await uacTokenInstance.balanceOf(tokenHolder2);

        const tx = await uacTokenInstance.transfer(tokenHolder2, 5, {from: tokenHolder1});

        const currentBalanceTokenHolder2 = await uacTokenInstance.balanceOf(tokenHolder2);

        balanceTokenHolder1.plus(balanceTokenHolder2).should.be.bignumber.equal(currentBalanceTokenHolder2);

        // Testing events
        const transferEvents = getEvents(tx, 'Transfer');

        transferEvents[0].from.should.equal(tokenHolder1);
        transferEvents[0].to.should.equal(tokenHolder2);
        transferEvents[0].value.should.bignumber.equal(5);
    });

    it('should transfer token from tokenHolder1 to tokenHolder2 using the tranferFrom method', async () => {
        const balanceTokenHolder2 = await uacTokenInstance.balanceOf(tokenHolder2);
        const balanceTokenHolder3 = await uacTokenInstance.balanceOf(tokenHolder3);

        const allowance1 = await uacTokenInstance.allowance(tokenHolder2, tokenHolder1);
        allowance1.should.be.bignumber.equal(0);

        await uacTokenInstance.approve(tokenHolder1, 5, {from: tokenHolder2});

        const allowance2 = await uacTokenInstance.allowance(tokenHolder2, tokenHolder1);
        allowance2.should.be.bignumber.equal(5);

        const tx = await uacTokenInstance.transferFrom(tokenHolder2, tokenHolder1, 5, {from: tokenHolder1});

        const currentBalanceTokenHolder1 = await uacTokenInstance.balanceOf(tokenHolder1);
        const currentBalanceTokenHolder2 = await uacTokenInstance.balanceOf(tokenHolder2);
        const currentBalanceTokenHolder3 = await uacTokenInstance.balanceOf(tokenHolder3);

        balanceTokenHolder3.should.be.bignumber.equal(currentBalanceTokenHolder3);
        currentBalanceTokenHolder1.should.be.bignumber.equal(allowance2);
        currentBalanceTokenHolder2.should.be.bignumber.equal(balanceTokenHolder2.minus(allowance2));

        // Testing events
        const transferEvents = getEvents(tx, 'Transfer');

        transferEvents[0].from.should.equal(tokenHolder2);
        transferEvents[0].to.should.equal(tokenHolder1);
        transferEvents[0].value.should.bignumber.equal(5);
    });
});
