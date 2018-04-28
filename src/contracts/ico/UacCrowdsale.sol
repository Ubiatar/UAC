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
    uint256 public constant TOTAL_MAX_CAP = 15e6 * 1e18;
    uint256 public constant CROWDSALE_CAP = 7.5e6 * 1e18;
    uint256 public constant FOUNDERS_CAP = 12e6 * 1e18;
    uint256 public constant UBIATARPLAY_CAP = 50.5e6 * 1e18;
    uint256 public constant ADVISORS_CAP = 491522144864109;
    uint256 public constant BONUS_TIER1 = 108;                           // 8% during first 3 hours
    uint256 public constant BONUS_TIER2 = 106;                           // 6% during next 9 hours
    uint256 public constant BONUS_TIER3 = 104;                           // 4% during next 30 hours
    uint256 public constant BONUS_DURATION_1 = 3 hours;
    uint256 public constant BONUS_DURATION_2 = 12 hours;
    uint256 public constant BONUS_DURATION_3 = 42 hours;
    uint256 public constant FOUNDERS_VESTING_CLIFF = 1 years;
    uint256 public constant FOUNDERS_VESTING_DURATION = 2 years;

    TokenVesting public foundersVault;
    UacToken public token;
    Reservation public reservation;
    UbiatarPlayVault public ubiatarPlayVault;
    PresaleTokenVault public presaleTokenVault;
    address public foundersWallet;
    address public advisorsWallet;
    address public ubiatarPlayWallet;
    address public wallet;

    bool public didOwnerEndCrowdsale;

    function UacCrowdsale(
        address _foundersWallet,
        address _advisorsWallet,
        address _ubiatarPlayWallet,
        address _wallet,
        address[] _kycSigners
    )
        public
        CrowdsaleBase(START_TIME, END_TIME, TOTAL_MAX_CAP, _wallet, _kycSigners)
    {
        foundersWallet = _foundersWallet;
        advisorsWallet = _advisorsWallet;
        ubiatarPlayWallet = _ubiatarPlayWallet;
        wallet = _wallet;
        token = new UacToken();
        reservation = new Reservation(address(this), _wallet, _kycSigners);
        reservation.transferOwnership(owner);
        ubiatarPlayVault = new UbiatarPlayVault(ubiatarPlayWallet, address(token), END_TIME);

        // Founders vault contract and mint contract's tokens
        foundersVault = new TokenVesting(foundersWallet, END_TIME, FOUNDERS_VESTING_CLIFF, FOUNDERS_VESTING_DURATION, false);
        mintTokens(address(foundersVault), FOUNDERS_CAP);

        // Mint advisors' tokens
        mintTokens(advisorsWallet, ADVISORS_CAP);

        // Mint UbiatarPlay tokens
        mintTokens(address(ubiatarPlayVault), UBIATARPLAY_CAP);
    }

    function createPresaleTokenVault(address[] beneficiaries, uint256[] balances) public onlyOwner {
        require(presaleTokenVault == address(0));
        presaleTokenVault = new PresaleTokenVault(beneficiaries, balances, PRESALE_VAULT_START, address(token));

        uint256 totalPresaleBalance = 0;
        uint256 balancesLength = balances.length;
        for(uint256 i = 0; i < balancesLength; i++) {
            totalPresaleBalance = totalPresaleBalance.add(balances[i]);
        }

        token.mint(presaleTokenVault, totalPresaleBalance);
    }

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

    function mintReservationTokens(address to, uint256 amount) public {
        require(msg.sender == address(reservation));
        tokensSold = tokensSold.add(amount);
        availableTokens = availableTokens.sub(amount);
        mintTokens(to, amount);
    }

    function mintTokens(address to, uint256 amount) private {
        token.mint(to, amount);
    }

    function closeCrowdsale() public onlyOwner {
        require(block.timestamp >= START_TIME && block.timestamp < END_TIME);
        didOwnerEndCrowdsale = true;
    }

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

