/**
 * @title Reservation
 *
 * @version 1.0
 * @author Validity Labs AG <info@validitylabs.org>
 */
pragma solidity ^0.4.19;

import "./CrowdsaleBase.sol";
import "./UacCrowdsale.sol";

contract Reservation is CrowdsaleBase {

    /*** CONSTANTS ***/
    uint256 public constant START_TIME = 1525683600;                     // 7 May 2018 09:00:00 GMT
    uint256 public constant END_TIME = 1525856400;                       // 9 May 2018 09:00:00 GMT
    uint256 public constant RESERVATION_CAP = 7.5e6 * 1e18;
    uint256 public constant BONUS = 110;                                 // 10% bonus

    UacCrowdsale crowdsale;

    function Reservation(
        address _crowdsale,
        address _wallet,
        address[] _kycSigners
    )
        public
        CrowdsaleBase(START_TIME, END_TIME, RESERVATION_CAP, _wallet, _kycSigners)
    {
        crowdsale = UacCrowdsale(_crowdsale);
    }

    function price() public view returns (uint256) {
        return tokenPerEth.mul(BONUS).div(1e2);
    }

    function mintTokens(address to, uint256 amount) private {
        crowdsale.mintReservationTokens(to, amount);
    }
}