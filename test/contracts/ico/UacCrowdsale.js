/**
 * Test for UacCrowdsale
 *
 * @author Validity Labs AG <info@validitylabs.org>
 */

import {expectThrow, waitNDays, BigNumber, increaseTimeTo} from '../helpers/tools';
import {logger as log} from '../../../tools/lib/logger';

const {ecsign} = require('ethereumjs-util');
const abi = require('ethereumjs-abi');
const BN = require('bn.js');

const UacCrowdsale = artifacts.require('./UacCrowdsale');
const UacToken = artifacts.require('./UacToken');
const Reservation = artifacts.require('./Reservation');
const TokenVesting  = artifacts.require('./TokenVesting');
const UbiatarPlayVault = artifacts.require('./UbiatarPlayVault.sol');
const PresaleTokenVault = artifacts.require('./PresaleTokenVault.sol');

const should = require('chai')                                                     // eslint-disable-line
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

// Values for testing buy methods with the required MAX_AMOUNT by Eidoo's KYCBase contract
const SIGNER_PK = Buffer.from('c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3', 'hex');
const MAX_AMOUNT = '1000000000000000000';

const getKycData = (userAddr, userid, icoAddr, pk) => {
    // sha256("Eidoo icoengine authorization", icoAddress, buyerAddress, buyerId, maxAmount);
    const hash = abi.soliditySHA256(
        ['string', 'address', 'address', 'uint64', 'uint'],
        ['Eidoo icoengine authorization', icoAddr, userAddr, new BN(userid), new BN(MAX_AMOUNT)]
    );
    const sig = ecsign(hash, pk);
    return {
        id: userid,
        max: MAX_AMOUNT,
        v: sig.v,
        r: '0x' + sig.r.toString('hex'),
        s: '0x' + sig.s.toString('hex')
    };
};

// Values with higher MAX_AMOUNT to test when cap has been reached
const MAX_AMOUNT_MOCK = '60001000000000000000000';

const getKycDataMockMaxAmount = (userAddr, userid, icoAddr, pk) => {
    // sha256("Eidoo icoengine authorization", icoAddress, buyerAddress, buyerId);
    const hash = abi.soliditySHA256(
        ['string', 'address', 'address', 'uint64', 'uint'],
        ['Eidoo icoengine authorization', icoAddr, userAddr, new BN(userid), new BN(MAX_AMOUNT_MOCK)]
    );
    const sig = ecsign(hash, pk);
    return {
        id: userid,
        max: MAX_AMOUNT_MOCK,
        v: sig.v,
        r: '0x' + sig.r.toString('hex'),
        s: '0x' + sig.s.toString('hex')
    };
};

const USD_PER_TOKEN = 2;
const USD_PER_ETHER = 500;
const TOKEN_PER_ETHER =  USD_PER_ETHER / USD_PER_TOKEN;                     // 250 UAC tokens per ether

const RESERVATION_START_TIME = 1525683600;                                  // 7 May 2018 09:00:00 GMT
const RESERVATION_END_TIME = 1525856400;                                    // 9 May 2018 09:00:00 GMT
const RESERVATION_CAP = new BigNumber(7.5e6 * 1e18);
const RESERVATION_BONUS = 110;                                              // 10%
const RESERVATION_PRICE = TOKEN_PER_ETHER * RESERVATION_BONUS;              // 275 UAC tokens per ether

const CROWDSALE_START_TIME = 1525856400;                                    // 9 May 2018 09:00:00 GMT
const CROWDSALE_END_TIME = 1528448400;                                      // 8 June 2018 09:00:00 GMT
const CROWDSALE_CAP = new BigNumber(15e6 * 1e18);                           // reservation and ico tokens
const FOUNDERS_CAP = new BigNumber(12e6 * 1e18);
const UBIATARPLAY_CAP = new BigNumber(50.5e6 * 1e18);
const ADVISORS_CAP = new BigNumber('4915221448641099899301307');
const CROWDSALE_BONUS_TIER1 = 108;                                          // 8% during first 3 hours
const CROWDSALE_BONUS_TIER2 = 106;                                          // 6% during next 9 hours
const CROWDSALE_BONUS_TIER3 = 104;                                          // 4% during next 30 hours
const CROWDSALE_BONUS_PERIOD1 = (3 * 60 * 60);                              // 3 hours
const CROWDSALE_BONUS_PERIOD2 = (12 * 60 * 60);                             // 12 hours
const CROWDSALE_BONUS_PERIOD3 = (42 * 60 * 60);                             // 42 hours
const FOUNDERS_VESTING_ClIFF = (1 * 365 * 24 * 60 * 60);                    // 1 year
const FOUNDERS_VESTING_DURATION = (2 * 365 * 24 * 60 * 60);                 // 2 year
const PRICE1 = TOKEN_PER_ETHER * CROWDSALE_BONUS_TIER1 / 100;               // 270 UAC tokens per ether
const PRICE2 = TOKEN_PER_ETHER * CROWDSALE_BONUS_TIER2 / 100;               // 265 UAC tokens per ether
const PRICE3 = TOKEN_PER_ETHER * CROWDSALE_BONUS_TIER3 / 100;               // 260 UAC tokens per ether

// Reservation phase: activeInvestor
const INVESTOR_WEI1 = 2e22;
const INVESTOR_TOKEN_AMOUNT1 = 550 * 1e22;                                  // Bonus - 10%

const INVESTOR_WEI2 = 1e22;                                                 // Bonus - 10%

// First investment: activeInvestor1
const INVESTOR1_WEI = 1e18;
const INVESTOR1_TOKEN_AMOUNT = 270 * 1e18;                                 // Bonus - 8%

// Second investment: activeInvestor2
const INVESTOR2_WEI1 = 1e2;
const INVESTOR2_TOKEN_AMOUNT1 = 265 * 1e2;                                 // Bonus - 6%

// Third investment: activeInvestor2
const INVESTOR2_WEI2 = 1e2;
const INVESTOR2_TOKEN_AMOUNT2 = 260 * 1e2;                                 // Bonus - 4%

// Four investment: activeInvestor3
const INVESTOR3_WEI1 = 1e18;
const INVESTOR3_TOKEN_AMOUNT1 = 250 * 1e18;                                // Bonus - 0

// Fift investment: activeInvestor3
const INVESTOR3_WEI2 = 6e22;

const PRESALE_INVESTOR1_AMOUNT = 1e18;

const PRESALE_INVESTOR2_AMOUNT = 2e18;

/**
 * UacCrowdsale contract
 */
contract('UacCrowdsale', (accounts) => {
    const owner = accounts[0];
    const activeInvestor = accounts[1];
    const activeInvestor1 = accounts[2];
    const activeInvestor2 = accounts[3];
    const activeInvestor3 = accounts[4];
    const advisor = accounts[5];
    const foundersWallet = accounts[6];
    const advisorsWallet = accounts[7];
    const ubiatarPlayWallet = accounts[8];
    const wallet = accounts[9];
    const presaleInvestor1 = owner;
    const presaleInvestor2 = wallet;

    let uacCrowdsaleInstance;
    let uacTokenInstance;
    let reservationAddress;
    let reservationInstance;
    let ubiatarPlayVaultAddress;
    let ubiatarPlayVaultInstance;
    let foundersVaultAddress;
    let foundersVaultInstance;
    let presaleTokenVaultAddress;
    let presaleTokenVaultInstance;

    // Provide uacCrowdsaleInstance for every test case
    beforeEach(async () => {
        uacCrowdsaleInstance = await UacCrowdsale.deployed();
        const uacTokenAddress = await uacCrowdsaleInstance.token();
        uacTokenInstance = await UacToken.at(uacTokenAddress);
    });

    /**
     * [ Pre contribution phase ]
     */
    it('should instantiate the UAC crowdsale correctly', async () => {
        log.info('[ Pre contribution phase ]');

        const _wallet = await uacCrowdsaleInstance.wallet();
        const _foundersWallet = await uacCrowdsaleInstance.foundersWallet();
        const _advisorsWallet = await uacCrowdsaleInstance.advisorsWallet();
        const _ubiatarPlayWallet = await uacCrowdsaleInstance.ubiatarPlayWallet();
        const started = await uacCrowdsaleInstance.started();
        const ended = await uacCrowdsaleInstance.ended();
        const startTime = await uacCrowdsaleInstance.startTime();
        const endTime = await uacCrowdsaleInstance.endTime();
        const totalTokens = await uacCrowdsaleInstance.totalTokens();
        const remainingTokens = await uacCrowdsaleInstance.remainingTokens();
        const foundersCap = await uacCrowdsaleInstance.FOUNDERS_CAP();
        const ubiatarPlayCap = await uacCrowdsaleInstance.UBIATARPLAY_CAP();
        const advisorsCap = await uacCrowdsaleInstance.ADVISORS_CAP();
        const bonusTier1 = await uacCrowdsaleInstance.BONUS_TIER1();
        const bonusTier2 = await uacCrowdsaleInstance.BONUS_TIER2();
        const bonusTier3 = await uacCrowdsaleInstance.BONUS_TIER3();
        const bonusDuration1 = await uacCrowdsaleInstance.BONUS_DURATION_1();
        const bonusDuration2 = await uacCrowdsaleInstance.BONUS_DURATION_2();
        const bonusDuration3 = await uacCrowdsaleInstance.BONUS_DURATION_3();
        const foundersVestingCliff = await uacCrowdsaleInstance.FOUNDERS_VESTING_CLIFF();
        const foundersVestingDuration = await uacCrowdsaleInstance.FOUNDERS_VESTING_DURATION();
        const ownerAccountZero = await uacCrowdsaleInstance.owner();
        const signer0 = await uacCrowdsaleInstance.kycSigners(0);

        signer0.should.be.equal('0x627306090abaB3A6e1400e9345bC60c78a8BEf57'.toLowerCase());

        _wallet.should.equal(wallet);
        _foundersWallet.should.equal(foundersWallet);
        _advisorsWallet.should.equal(advisorsWallet);
        _ubiatarPlayWallet.should.equal(ubiatarPlayWallet);
        assert.isFalse(started);
        assert.isFalse(ended);
        startTime.should.be.bignumber.equal(CROWDSALE_START_TIME);
        endTime.should.be.bignumber.equal(CROWDSALE_END_TIME);
        totalTokens.should.be.bignumber.equal(CROWDSALE_CAP);
        remainingTokens.should.be.bignumber.equal(CROWDSALE_CAP);
        foundersCap.should.be.bignumber.equal(FOUNDERS_CAP);
        ubiatarPlayCap.should.be.bignumber.equal(UBIATARPLAY_CAP);
        advisorsCap.should.be.bignumber.equal(ADVISORS_CAP);
        bonusTier1.should.be.bignumber.equal(CROWDSALE_BONUS_TIER1);
        bonusTier2.should.be.bignumber.equal(CROWDSALE_BONUS_TIER2);
        bonusTier3.should.be.bignumber.equal(CROWDSALE_BONUS_TIER3);
        bonusDuration1.should.be.bignumber.equal(CROWDSALE_BONUS_PERIOD1);
        bonusDuration2.should.be.bignumber.equal(CROWDSALE_BONUS_PERIOD2);
        bonusDuration3.should.be.bignumber.equal(CROWDSALE_BONUS_PERIOD3);
        foundersVestingCliff.should.be.bignumber.equal(FOUNDERS_VESTING_ClIFF);
        foundersVestingDuration.should.be.bignumber.equal(FOUNDERS_VESTING_DURATION);
        ownerAccountZero.should.equal(owner);
    });

    it('should have token ownership', async () => {
        const uacTokenInstanceOwner = await uacTokenInstance.owner();

        uacTokenInstanceOwner.should.equal(uacCrowdsaleInstance.address);
    });

    it('should instantiate the reservation contract correctly', async () => {
        reservationAddress = await uacCrowdsaleInstance.reservation();
        reservationInstance = await Reservation.at(reservationAddress);

        const started = await reservationInstance.started();
        const ended = await reservationInstance.ended();
        const startTime = await reservationInstance.startTime();
        const endTime = await reservationInstance.endTime();
        const totalTokens = await reservationInstance.totalTokens();
        const remainingTokens = await reservationInstance.remainingTokens();
        const price = await reservationInstance.price();
        const bonus = await reservationInstance.BONUS();
        const signer0 = await reservationInstance.kycSigners(0);
        const crowd = await reservationInstance.crowdsale();

        signer0.should.be.equal('0x627306090abaB3A6e1400e9345bC60c78a8BEf57'.toLowerCase());


        assert.isFalse(started);
        assert.isFalse(ended);
        startTime.should.be.bignumber.equal(RESERVATION_START_TIME);
        endTime.should.be.bignumber.equal(RESERVATION_END_TIME);
        totalTokens.should.be.bignumber.equal(RESERVATION_CAP);
        remainingTokens.should.be.bignumber.equal(RESERVATION_CAP);
        price.should.be.bignumber.equal(RESERVATION_PRICE / 100);
        bonus.should.be.bignumber.equal(RESERVATION_BONUS);
    });

    it('should instantiate the foundersVault correctly', async () => {
        foundersVaultAddress = await uacCrowdsaleInstance.foundersVault();
        foundersVaultInstance = await TokenVesting.at(foundersVaultAddress);
        const foundersVaultBalance = await uacTokenInstance.balanceOf(foundersVaultAddress);

        foundersVaultBalance.should.be.bignumber.equal(FOUNDERS_CAP);
    });

    it('should instantiate the ubiatarPlayVault correctly', async () => {
        ubiatarPlayVaultAddress = await uacCrowdsaleInstance.ubiatarPlayVault();
        ubiatarPlayVaultInstance = await UbiatarPlayVault.at(ubiatarPlayVaultAddress);
        const ubiatarPlayVaultBalance = await uacTokenInstance.balanceOf(ubiatarPlayVaultAddress);

        ubiatarPlayVaultBalance.should.be.bignumber.equal(UBIATARPLAY_CAP);
    });

    it('should init the presaleTokenVault correctly', async () => {
        presaleTokenVaultAddress = await uacCrowdsaleInstance.presaleTokenVault();
        presaleTokenVaultInstance = await PresaleTokenVault.at(presaleTokenVaultAddress);

        await uacCrowdsaleInstance.initPresaleTokenVault([presaleInvestor1, presaleInvestor2], [PRESALE_INVESTOR1_AMOUNT, PRESALE_INVESTOR2_AMOUNT]);
        const presaleTokenVaultBalance = await uacTokenInstance.balanceOf(presaleTokenVaultAddress);

        presaleTokenVaultBalance.should.be.bignumber.equal(PRESALE_INVESTOR1_AMOUNT + PRESALE_INVESTOR2_AMOUNT);
    });

    it('should fail, buyTokens method can not be called before reservation phase starts', async () => {
        const d = getKycData(activeInvestor, 0, reservationAddress, SIGNER_PK);

        await expectThrow(reservationInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor, value: MAX_AMOUNT}));
    });

    /**
     * [ Reservation phase: 2018-05-07 09:00:00 GTM until 2018-05-09 09:00:00 GMT
     */
    it('should increase time to reservation phase', async () => {
        log.info('[ Reservation phase ]');

        await increaseTimeTo(RESERVATION_START_TIME);
    });

    it('should return true when the started method is called', async () => {
        const started = await reservationInstance.started();

        assert.isTrue(started);
    });

    it('should calculate the token total supply correctly', async () => {
        const presaleTokenVaultBalance = await uacTokenInstance.balanceOf(presaleTokenVaultAddress);
        const foundersVaultBalance = await uacTokenInstance.balanceOf(foundersVaultAddress);
        const ubiatarPlayVaultBalance = await uacTokenInstance.balanceOf(ubiatarPlayVaultAddress);
        const advisorsBalance = await uacTokenInstance.balanceOf(advisorsWallet);
        const totalSupply = await uacTokenInstance.totalSupply();

        totalSupply.should.be.bignumber.equal(presaleTokenVaultBalance.plus(foundersVaultBalance).plus(ubiatarPlayVaultBalance).plus(advisorsBalance));
    });

    it('should allow investment when calling buyToken after reservation phase starts and update totalSupply', async () => {
        const activeInvestorBalance1 = await uacTokenInstance.balanceOf(activeInvestor);
        const totalSupply1 = await uacTokenInstance.totalSupply();

        activeInvestorBalance1.should.be.bignumber.equal(0);

        const d = getKycDataMockMaxAmount(activeInvestor, 0, reservationAddress, SIGNER_PK);

        await reservationInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor, value: INVESTOR_WEI1});

        const activeInvestorBalance2 = await uacTokenInstance.balanceOf(activeInvestor);
        const totalSupply2 = await uacTokenInstance.totalSupply();

        activeInvestorBalance2.should.be.bignumber.equal(INVESTOR_TOKEN_AMOUNT1);
        totalSupply2.should.be.bignumber.equal(totalSupply1.plus(activeInvestorBalance2));
    });

    it('should calculate remaining tokens correctly', async () => {
        const remainingTokens = await reservationInstance.remainingTokens();
        const activeInvestorBalance = await uacTokenInstance.balanceOf(activeInvestor);

        remainingTokens.should.be.bignumber.equal(RESERVATION_CAP.minus(activeInvestorBalance));
    });

    it('should be possible to pause the reservation phase by the owner', async () => {
        log.info('[ Reservation phase - is paused ]');

        await reservationInstance.pause();

        const paused = await reservationInstance.paused();
        const activeInvestorBalance1 = await uacTokenInstance.balanceOf(activeInvestor);
        const d = getKycData(activeInvestor, 0, reservationAddress, SIGNER_PK);

        await expectThrow(reservationInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor, value: MAX_AMOUNT}));

        const activeInvestorBalance2 = await uacTokenInstance.balanceOf(activeInvestor);

        assert.isTrue(paused);
        activeInvestorBalance1.should.be.bignumber.equal(activeInvestorBalance2);
    });

    it('should be possible to unpause the reservation phase by the owner', async () => {
        log.info('[ Reservation phase - is unpaused and gets new investment ]');

        await reservationInstance.unpause();

        const paused = await reservationInstance.paused();

        assert.isFalse(paused);
    });

    it('should set capReached to true and remaining tokens to zero', async () => {
        const d = getKycDataMockMaxAmount(activeInvestor, 0, reservationAddress, SIGNER_PK);
        await reservationInstance.buyTokensFor(activeInvestor, d.id, d.max, d.v, d.r, d.s, {from: activeInvestor1, value: INVESTOR_WEI2});
        const capReached = await reservationInstance.capReached();
        const remainingTokens = await reservationInstance.remainingTokens();

        assert.isTrue(capReached);
        remainingTokens.should.be.bignumber.equal(0);
    });

    it('should fail, is not possible to buy tokens after the reservation cap has been reached', async () => {
        const activeInvestorBalance1 = await uacTokenInstance.balanceOf(activeInvestor);
        const d = getKycData(activeInvestor, 0, reservationAddress, SIGNER_PK);

        await expectThrow(reservationInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor, value: INVESTOR_WEI2}));

        const activeInvestorBalance2 = await uacTokenInstance.balanceOf(activeInvestor);

        activeInvestorBalance1.should.be.bignumber.equal(activeInvestorBalance2);
    });

    it('should fail, is not possible to transfer tokens before end of crowdsale phase', async () => {
        await expectThrow(uacTokenInstance.transfer(activeInvestor1, 1, {from: activeInvestor}));

        const activeInvestor1Balance = await uacTokenInstance.balanceOf(activeInvestor1);
        activeInvestor1Balance.should.be.bignumber.equal(0);
    });

    it('should fail, buyTokens method can not be called before crowdsale phase starts', async () => {
        const d = getKycData(activeInvestor1, 1, uacCrowdsaleInstance.address, SIGNER_PK);
        await expectThrow(uacCrowdsaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor1, value: INVESTOR1_WEI}));
    });

    it('should fail, closeCrowdsale method can not be called before crowdsale phase starts', async () => {
        await expectThrow(uacCrowdsaleInstance.closeCrowdsale({from: owner}));
    });

    it('should fail, finalise method can not be called before crowdsale phase starts', async () => {
        await expectThrow(uacCrowdsaleInstance.finalise({from: owner}));
    });

    /**
     * [ End Reservation Phase - Start Crowdsale phase: 2018-05-09 09:00:00 GTM until 2018-06-08 09:00:00 GMT ]
     */
    it('should increase time to the end of the reservation phase)', async () => {
        log.info('[ End Reservation Phase ]');
        await increaseTimeTo(RESERVATION_END_TIME + 1);
    });

    it('should return true when the ended method from reservation contract is called', async () => {
        const ended = await reservationInstance.ended();

        assert.isTrue(ended);
    });

    it('should return true when the started method from crowdsale contract is called', async () => {
        const started = await uacCrowdsaleInstance.started();

        assert.isTrue(started);
    });

    it('should calculate the remaining tokens for the crowdsale phase correctly', async () => {
        const reservationTokensSold = await reservationInstance.tokensSold();
        const crowdsaleTokensSold = await uacCrowdsaleInstance.tokensSold();
        const crowdsaleRemainingTokens = await uacCrowdsaleInstance.remainingTokens();

        reservationTokensSold.should.be.bignumber.equal(RESERVATION_CAP);
        crowdsaleTokensSold.should.be.bignumber.equal(reservationTokensSold);
        crowdsaleRemainingTokens.should.be.bignumber.equal(CROWDSALE_CAP.minus(RESERVATION_CAP));
    });

    it('should allow investment when calling buyToken', async () => {
        log.info('[ Crowdsale phase - first bonus bracket ]');
        const price = await uacCrowdsaleInstance.price();
        const d = getKycData(activeInvestor1, 1, uacCrowdsaleInstance.address, SIGNER_PK);

        await uacCrowdsaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor1, value: INVESTOR1_WEI});

        const activeInvestor1Balance = await uacTokenInstance.balanceOf(activeInvestor1);

        price.should.be.bignumber.equal(PRICE1);
        activeInvestor1Balance.should.be.bignumber.equal(INVESTOR1_TOKEN_AMOUNT);
    });

    it('should increase time to the second bonus bracket - 6%)', async () => {
        log.info('[ Crowdsale phase - second bonus bracket ]');
        await increaseTimeTo(CROWDSALE_START_TIME + CROWDSALE_BONUS_PERIOD1 + 1);
    });

    it('should allow investment when calling the buyTokenFor method', async () => {
        const price = await uacCrowdsaleInstance.price();
        const d = getKycData(activeInvestor2, 2, uacCrowdsaleInstance.address, SIGNER_PK);

        await uacCrowdsaleInstance.buyTokensFor(activeInvestor2, d.id, d.max, d.v, d.r, d.s, {from: activeInvestor1, value: INVESTOR2_WEI1});

        const activeInvestor2Balance = await uacTokenInstance.balanceOf(activeInvestor2);

        price.should.be.bignumber.equal(PRICE2);
        activeInvestor2Balance.should.be.bignumber.equal(INVESTOR2_TOKEN_AMOUNT1);
    });

    it('should increase time to third bonus bracket - 4%)', async () => {
        log.info('[ Crowdsale phase - third bonus bracket ]');
        await increaseTimeTo(CROWDSALE_START_TIME + CROWDSALE_BONUS_PERIOD2 + 1);
    });

    it('should allow second investment for activeInvestor2 when calling buyToken', async () => {
        const price = await uacCrowdsaleInstance.price();
        const d = getKycData(activeInvestor2, 2, uacCrowdsaleInstance.address, SIGNER_PK);

        await uacCrowdsaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor2, value: INVESTOR2_WEI2});

        const activeInvestor2Balance = await uacTokenInstance.balanceOf(activeInvestor2);

        price.should.be.bignumber.equal(PRICE3);
        activeInvestor2Balance.should.be.bignumber.equal(INVESTOR2_TOKEN_AMOUNT1 + INVESTOR2_TOKEN_AMOUNT2);
    });

    it('should increase time to after bonus period)', async () => {
        log.info('[ Crowdsale phase - bonus period ended ]');
        await increaseTimeTo(CROWDSALE_START_TIME + CROWDSALE_BONUS_PERIOD3 + 1);
    });

    it('should be possible to pause the crowdsale by the owner', async () => {
        log.info('[ Crowdsale phase - is paused ]');

        await uacCrowdsaleInstance.pause({from: owner});

        const paused = await uacCrowdsaleInstance.paused();
        const d = getKycData(activeInvestor3, 3, uacCrowdsaleInstance.address, SIGNER_PK);

        await expectThrow(uacCrowdsaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor3, value: INVESTOR3_WEI1}));

        const activeInvestor3Balance = await uacTokenInstance.balanceOf(activeInvestor3);

        assert.isTrue(paused);
        activeInvestor3Balance.should.be.bignumber.equal(0);
    });

    it('should be possible to unpause the crowdsale by the owner', async () => {
        log.info('[ Crowdsale phase - is unpaused and gets new investment with no bonus ]');

        await uacCrowdsaleInstance.unpause({from: owner});

        const paused = await uacCrowdsaleInstance.paused();

        assert.isFalse(paused);

        const d = getKycData(activeInvestor3, 3, uacCrowdsaleInstance.address, SIGNER_PK);

        await uacCrowdsaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor3, value: INVESTOR3_WEI1});

        const activeInvestor3Balance = await uacTokenInstance.balanceOf(activeInvestor3);

        activeInvestor3Balance.should.be.bignumber.equal(INVESTOR3_TOKEN_AMOUNT1);
    });

    it('should set capReached to true and remaining tokens to zero', async () => {
        const d = getKycDataMockMaxAmount(activeInvestor3, 3, uacCrowdsaleInstance.address, SIGNER_PK);

        await uacCrowdsaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor3, value: INVESTOR3_WEI2});

        const capReached = await uacCrowdsaleInstance.capReached();

        assert.isTrue(capReached);
    });

    it('should fail, is not possible to buy tokens after the cap has been reached', async () => {
        const activeInvestor1Balance1 = await uacTokenInstance.balanceOf(activeInvestor1);
        const d = getKycData(activeInvestor1, 1, uacCrowdsaleInstance.address, SIGNER_PK);

        await expectThrow(uacCrowdsaleInstance.buyTokens(d.id, d.max, d.v, d.r, d.s, {from: activeInvestor1, value: MAX_AMOUNT}));

        const activeInvestor1Balance2 = await uacTokenInstance.balanceOf(activeInvestor1);

        activeInvestor1Balance1.should.be.bignumber.equal(activeInvestor1Balance2);
    });

    it('should fail, is not possible to transfer tokens during crowdsale phase', async () => {
        await expectThrow(uacTokenInstance.transfer(activeInvestor1, 1, {from: activeInvestor2}));

        const activeInvestor1Balance = await uacTokenInstance.balanceOf(activeInvestor1);

        activeInvestor1Balance.should.be.bignumber.equal(INVESTOR1_TOKEN_AMOUNT);
    });

    it('should fail, closeCrowdsale method can only be called by the owner', async () => {
        await expectThrow(uacCrowdsaleInstance.closeCrowdsale({from: activeInvestor2}));
    });

    it('should fail, finalise method can only be called by the owner', async () => {
        await expectThrow(uacCrowdsaleInstance.finalise({from: activeInvestor2}));
    });

    /**
     * [ End Crowdsale Phase ]
     */
    it('should call closeCrowdsale method successfully from owner address', async () => {
        await uacCrowdsaleInstance.closeCrowdsale({from: owner});

        const didOwnerEndCrowdsale = await uacCrowdsaleInstance.didOwnerEndCrowdsale();

        assert.isTrue(didOwnerEndCrowdsale);
    });

    it('should increase time to the end of the crowdsale phase)', async () => {
        log.info('[ End Crowdsale Phase ]');

        await increaseTimeTo(CROWDSALE_END_TIME + 1);
    });

    it('should finalise crowdsale sucessfully', async () => {
        let tokenPaused = await uacTokenInstance.paused();
        let mintingFinished = await uacTokenInstance.mintingFinished();
        let tokenOwner = await uacTokenInstance.owner();

        assert.isTrue(tokenPaused);
        assert.isFalse(mintingFinished);
        tokenOwner.should.equal(uacCrowdsaleInstance.address);

        await uacCrowdsaleInstance.finalise({from: owner});
        tokenPaused = await uacTokenInstance.paused();
        mintingFinished = await uacTokenInstance.mintingFinished();
        tokenOwner = await uacTokenInstance.owner();

        assert.isFalse(tokenPaused);
        assert.isTrue(mintingFinished);
        tokenOwner.should.equal(owner);
    });

    it('should return true when the ended method is called', async () => {
        const ended = await uacCrowdsaleInstance.ended();

        assert.isTrue(ended);
    });

    it('should allow transfer of tokens', async () => {
        const advisorsWalletBalance1 = await uacTokenInstance.balanceOf(advisorsWallet);
        const advisorBalance1 = await uacTokenInstance.balanceOf(advisor);

        advisorsWalletBalance1.should.be.bignumber.equal(ADVISORS_CAP);
        advisorBalance1.should.be.bignumber.equal(0);

        await uacTokenInstance.transfer(advisor, 1, {from: advisorsWallet});

        const advisorsWalletBalance2 = await uacTokenInstance.balanceOf(advisorsWallet);
        const advisorBalance2 = await uacTokenInstance.balanceOf(advisor);

        advisorsWalletBalance2.should.be.bignumber.equal(ADVISORS_CAP.minus(1));
        advisorBalance2.should.be.bignumber.equal(1);
    });

    /**
     * [ Vesting phases ]
     */
    it('should increase time to release 1', async () => {
        log.info('[ Vesting starts]');

        await waitNDays(7);
    });

    it('should release presale vested tokens 1', async () => {
        const presaleTokenVaultBalance1 = await uacTokenInstance.balanceOf(presaleTokenVaultAddress);
        const presaleInvestor1Balance1 = await uacTokenInstance.balanceOf(presaleInvestor1);
        const presaleInvestor2Balance1 = await uacTokenInstance.balanceOf(presaleInvestor2);

        presaleInvestor1Balance1.should.be.bignumber.equal(0);
        presaleInvestor2Balance1.should.be.bignumber.equal(0);
        presaleTokenVaultBalance1.should.be.bignumber.equal(PRESALE_INVESTOR1_AMOUNT + PRESALE_INVESTOR2_AMOUNT);

        await presaleTokenVaultInstance.release(presaleInvestor1);

        const presaleTokenVaultBalance2 = await uacTokenInstance.balanceOf(presaleTokenVaultAddress);
        const presaleInvestor1Balance2 = await uacTokenInstance.balanceOf(presaleInvestor1);
        const presaleInvestor2Balance2 = await uacTokenInstance.balanceOf(presaleInvestor2);

        assert.notEqual(presaleInvestor1Balance2, 0);
        presaleInvestor2Balance2.should.be.bignumber.equal(0);
        presaleInvestor1Balance2.plus(presaleTokenVaultBalance2).should.be.bignumber.equal(PRESALE_INVESTOR1_AMOUNT + PRESALE_INVESTOR2_AMOUNT);
    });

    it('should increase time to release 2', async () => {
        log.info('[ Vesting starts]');

        await waitNDays(83);
    });

    it('should release UbiatarPlay vested tokens 1', async () => {
        const ubiatarPlayWalletBalance1 = await uacTokenInstance.balanceOf(ubiatarPlayWallet);
        const vaultBalance1 = await uacTokenInstance.balanceOf(ubiatarPlayVaultAddress);

        ubiatarPlayWalletBalance1.should.be.bignumber.equal(0);
        vaultBalance1.should.be.bignumber.equal(UBIATARPLAY_CAP);

        await ubiatarPlayVaultInstance.release();

        const ubiatarPlayWalletBalance2 = await uacTokenInstance.balanceOf(ubiatarPlayWallet);
        const vaultBalance2 = await uacTokenInstance.balanceOf(ubiatarPlayVaultAddress);

        assert.notEqual(ubiatarPlayWalletBalance2, 0);
        vaultBalance1.should.be.bignumber.equal(vaultBalance2.plus(ubiatarPlayWalletBalance2));
    });

    it('should increase time to release 3', async () => {
        log.info('[ Vesting starts]');

        await waitNDays(187);
    });

    it('should release presale vested tokens 2', async () => {
        await presaleTokenVaultInstance.release(presaleInvestor1);
        await presaleTokenVaultInstance.release(presaleInvestor2);

        const presaleTokenVaultBalance = await uacTokenInstance.balanceOf(presaleTokenVaultAddress);
        const presaleInvestor1Balance = await uacTokenInstance.balanceOf(presaleInvestor1);
        const presaleInvestor2Balance = await uacTokenInstance.balanceOf(presaleInvestor2);

        presaleTokenVaultBalance.should.be.bignumber.equal(0);
        presaleInvestor1Balance.should.be.bignumber.equal(PRESALE_INVESTOR1_AMOUNT);
        presaleInvestor2Balance.should.be.bignumber.equal(PRESALE_INVESTOR2_AMOUNT);
    });

    it('should increase time to release 4', async () => {
        log.info('[ Vesting starts]');

        await waitNDays(88);
    });

    it('should release founders vested tokens', async () => {
        const foundersWalletBalance1 = await uacTokenInstance.balanceOf(foundersWallet);
        const vaultBalance1 = await uacTokenInstance.balanceOf(foundersVaultAddress);

        foundersWalletBalance1.should.be.bignumber.equal(0);
        vaultBalance1.should.be.bignumber.equal(FOUNDERS_CAP);

        await foundersVaultInstance.release(uacTokenInstance.address);

        const foundersWalletBalance2 = await uacTokenInstance.balanceOf(foundersWallet);
        const vaultBalance2 = await uacTokenInstance.balanceOf(foundersVaultAddress);

        assert.notEqual(foundersWalletBalance2, 0);
        vaultBalance1.should.be.bignumber.equal(vaultBalance2.plus(foundersWalletBalance2));
    });

    it('should increase time to release 5', async () => {
        log.info('[ Vesting starts]');

        await waitNDays(365);
    });

    it('should release remaining founders vested tokens', async () => {
        await foundersVaultInstance.release(uacTokenInstance.address);

        const foundersWalletBalance = await uacTokenInstance.balanceOf(foundersWallet);
        const vaultBalance = await uacTokenInstance.balanceOf(foundersVaultAddress);

        foundersWalletBalance.should.be.bignumber.equal(FOUNDERS_CAP);
        vaultBalance.should.be.bignumber.equal(0);
    });

    it('should release UbiatarPlay vested tokens', async () => {
        await ubiatarPlayVaultInstance.release();

        const ubiatarPlayWalletBalance = await uacTokenInstance.balanceOf(ubiatarPlayWallet);
        const vaultBalance = await uacTokenInstance.balanceOf(ubiatarPlayVaultAddress);

        ubiatarPlayWalletBalance.should.be.bignumber.equal(UBIATARPLAY_CAP);
        vaultBalance.should.be.bignumber.equal(0);
    });
});
