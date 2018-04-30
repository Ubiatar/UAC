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

    /**
     * @dev Constructor.
     * @notice Unsold tokens should add up to the crowdsale hard cap.
     * @param _crowdsale The address of the crowdsale contract.
     * @param _wallet The address where funds should be transferred.
     * @param _kycSigners Array of the signers addresses required by the KYCBase constructor, provided by Eidoo.
     * See https://github.com/eidoo/icoengine
     */
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

    /**
     * @dev Implements the price function from EidooEngineInterface.
     * @notice Calculates the price as tokens/ether based on the corresponding bonus.
     * @return Price as tokens/ether.
     */
    function price() public view returns (uint256) {
        return tokenPerEth.mul(BONUS).div(1e2);
    }

    /**
     * @dev Fires the mintReservationTokens function on the crowdsale contract to mint the tokens being sold during the reservation phase.
     * This function is called by the releaseTokensTo function, as part of the KYCBase implementation.
     * @param to The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mintTokens(address to, uint256 amount) private {
        crowdsale.mintReservationTokens(to, amount);
    }
}