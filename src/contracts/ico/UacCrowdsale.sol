/**
 * @title UacCrowdsale
 *
 * @version 1.0
 * @author Validity Labs AG <info@validitylabs.org>
 */
pragma solidity ^0.4.19;

import "../../../node_modules/zeppelin-solidity/contracts/token/ERC20/TokenVesting.sol";

import "./CrowdsaleBase.sol";
import "./Reservation.sol";
import "./UbiatarPlayVault.sol";
import "./UacToken.sol";
import "./PresaleTokenVault.sol";

contract UacCrowdsale is CrowdsaleBase {

    /*** CONSTANTS ***/
    uint256 public constant START_TIME = 1525856400;                     // 9 May 2018 09:00:00 GMT
    uint256 public constant END_TIME = 1528448400;                       // 8 June 2018 09:00:00 GMT
    uint256 public constant PRESALE_VAULT_START = END_TIME + 7 days;
    uint256 public constant PRESALE_CAP = 17584778551358900100698693;
    uint256 public constant TOTAL_MAX_CAP = 15e6 * 1e18;                // Reservation plus main sale tokens
    uint256 public constant CROWDSALE_CAP = 7.5e6 * 1e18;
    uint256 public constant FOUNDERS_CAP = 12e6 * 1e18;
    uint256 public constant UBIATARPLAY_CAP = 50.5e6 * 1e18;
    uint256 public constant ADVISORS_CAP = 4915221448641099899301307;

    // Eidoo interface requires price as tokens/ether, therefore the discounts are presented as bonus tokens.
    uint256 public constant BONUS_TIER1 = 108;                           // 8% during first 3 hours
    uint256 public constant BONUS_TIER2 = 106;                           // 6% during next 9 hours
    uint256 public constant BONUS_TIER3 = 104;                           // 4% during next 30 hours
    uint256 public constant BONUS_DURATION_1 = 3 hours;
    uint256 public constant BONUS_DURATION_2 = 12 hours;
    uint256 public constant BONUS_DURATION_3 = 42 hours;

    uint256 public constant FOUNDERS_VESTING_CLIFF = 1 years;
    uint256 public constant FOUNDERS_VESTING_DURATION = 2 years;

    Reservation public reservation;

    // Vesting contracts.
    PresaleTokenVault public presaleTokenVault;
    TokenVesting public foundersVault;
    UbiatarPlayVault public ubiatarPlayVault;

    // Vesting wallets.
    address public foundersWallet;
    address public advisorsWallet;
    address public ubiatarPlayWallet;

    address public wallet;

    UacToken public token;

    address[] public kycSigners;

    // Lets owner manually end crowdsale.
    bool public didOwnerEndCrowdsale;

    /**
     * @dev Constructor.
     * @param _foundersWallet address Wallet holding founders tokens.
     * @param _advisorsWallet address Wallet holding advisors tokens.
     * @param _ubiatarPlayWallet address Wallet holding ubiatarPlay tokens.
     * @param _wallet The address where funds should be transferred.
     * @param _kycSigners Array of the signers addresses required by the KYCBase constructor, provided by Eidoo.
     * See https://github.com/eidoo/icoengine
     */
    function UacCrowdsale(
        address _token,
        address _reservation,
        address _presaleTokenVault,
        address _foundersWallet,
        address _advisorsWallet,
        address _ubiatarPlayWallet,
        address _wallet,
        address[] _kycSigners
    )
        public
        CrowdsaleBase(START_TIME, END_TIME, TOTAL_MAX_CAP, _wallet, _kycSigners)
    {
        token = UacToken(_token);
        reservation = Reservation(_reservation);
        presaleTokenVault = PresaleTokenVault(_presaleTokenVault);
        foundersWallet = _foundersWallet;
        advisorsWallet = _advisorsWallet;
        ubiatarPlayWallet = _ubiatarPlayWallet;
        wallet = _wallet;
        kycSigners = _kycSigners;
        // Create founders vault contract
        foundersVault = new TokenVesting(foundersWallet, END_TIME, FOUNDERS_VESTING_CLIFF, FOUNDERS_VESTING_DURATION, false);

        // Create Ubiatar Play vault contract
        ubiatarPlayVault = new UbiatarPlayVault(ubiatarPlayWallet, address(token), END_TIME);
    }

    function mintPreAllocatedTokens() public onlyOwner {
        mintTokens(address(foundersVault), FOUNDERS_CAP);
        mintTokens(advisorsWallet, ADVISORS_CAP);
        mintTokens(address(ubiatarPlayVault), UBIATARPLAY_CAP);
    }

    /**
     * @dev Creates the presale vault contract.
     * @param beneficiaries Array of the presale investors addresses to whom vested tokens are transferred.
     * @param balances Array of token amount per beneficiary.
     */
    function setPresaleTokenVault(address _presaleTokenVault, address[] beneficiaries, uint256[] balances) public onlyOwner {

        // makes sure this function is only called once
        require(presaleTokenVault == address(0));

        require(beneficiaries.length == balances.length);
        presaleTokenVault = PresaleTokenVault(_presaleTokenVault);
        presaleTokenVault.init(beneficiaries, balances, PRESALE_VAULT_START, token);

        uint256 totalPresaleBalance = 0;
        uint256 balancesLength = balances.length;
        for(uint256 i = 0; i < balancesLength; i++) {
            totalPresaleBalance = totalPresaleBalance.add(balances[i]);
        }

        mintTokens(presaleTokenVault, totalPresaleBalance);
    }

    /**
     * @dev Implements the price function from EidooEngineInterface.
     * @notice Calculates the price as tokens/ether based on the corresponding bonus bracket.
     * @return Price as tokens/ether.
     */
    function price() public view returns (uint256 _price) {
        if (block.timestamp <= start.add(BONUS_DURATION_1)) {
            return tokenPerEth.mul(BONUS_TIER1).div(1e2);
        } else if (block.timestamp <= start.add(BONUS_DURATION_2)) {
            return tokenPerEth.mul(BONUS_TIER2).div(1e2);
        } else if (block.timestamp <= start.add(BONUS_DURATION_3)) {
            return tokenPerEth.mul(BONUS_TIER3).div(1e2);
        }
        return tokenPerEth;
    }

    /**
     * @dev Mints tokens being sold during the reservation phase, as part of the implementation of the releaseTokensTo function
     * from the KYCBase contract.
     * Also, updates tokensSold and availableTokens in the crowdsale contract.
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mintReservationTokens(address to, uint256 amount) public {
        require(msg.sender == address(reservation));
        tokensSold = tokensSold.add(amount);
        availableTokens = availableTokens.sub(amount);
        mintTokens(to, amount);
    }

    /**
     * @dev Mints tokens being sold during the crowdsale phase as part of the implementation of releaseTokensTo function
     * from the KYCBase contract.
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mintTokens(address to, uint256 amount) private {
        token.mint(to, amount);
    }

    /**
     * @dev Allows the owner to close the crowdsale manually before the end time.
     */
    function closeCrowdsale() public onlyOwner {
        require(block.timestamp >= START_TIME && block.timestamp < END_TIME);
        didOwnerEndCrowdsale = true;
    }

    /**
     * @dev Allows the owner to unpause tokens, stop minting and transfer ownership of the token contract.
     */
    function finalise() public onlyOwner {
        require(didOwnerEndCrowdsale || block.timestamp > end || capReached);
        token.finishMinting();
        token.unpause();

        // Token contract extends CanReclaimToken so the owner can recover any ERC20 token received in this contract by mistake.
        // So far, the owner of the token contract is the crowdsale contract.
        // We transfer the ownership so the owner of the crowdsale is also the owner of the token.
        token.transferOwnership(owner);
    }
}

