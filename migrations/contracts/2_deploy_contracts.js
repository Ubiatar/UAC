/**
 * Migration - ICO
 */

// const UacToken = artifacts.require('./ico/UacToken.sol');
const UacCrowdsale = artifacts.require('./ico/UacCrowdsale.sol');

module.exports = (deployer, network, accounts) => {                          // eslint-disable-line
    const foundersWallet = accounts[6];
    const advisorsWallet = accounts[7];
    const ubiatarPlayWallet = accounts[8];
    const wallet = accounts[9];
    const kycSigners = ['0x627306090abaB3A6e1400e9345bC60c78a8BEf57'.toLowerCase()];

    // deployer.deploy(UacToken);
    deployer.deploy(
        UacCrowdsale,
        foundersWallet,
        advisorsWallet,
        ubiatarPlayWallet,
        wallet,
        kycSigners
    );
};

