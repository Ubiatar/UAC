/**
 * @title CrowdsaleBase
 * @dev Base crowdsale contract to be inherited by the UacCrowdsale and Reservation contracts.
 *
 * @version 1.0
 * @author Validity Labs AG <info@validitylabs.org>
 */
pragma solidity ^0.4.19;

import "../../../node_modules/zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "../../../node_modules/zeppelin-solidity/contracts/ownership/CanReclaimToken.sol";

import "./KYCBase.sol";
import "./ICOEngineInterface.sol";

contract CrowdsaleBase is Pausable, CanReclaimToken, ICOEngineInterface, KYCBase {

    /*** CONSTANTS ***/
    uint256 public constant USD_PER_TOKEN = 2;                        //
    uint256 public constant USD_PER_ETHER = 500;                      // @TODO: adjust on deployment date

    uint256 public start;                                             // ICOEngineInterface
    uint256 public end;                                               // ICOEngineInterface
    uint256 public cap;                                               // ICOEngineInterface
    address public wallet;
    uint256 public tokenPerEth;
    uint256 public availableTokens;                                   // ICOEngineInterface
    address[] public kycSigners;                                      // KYCBase
    bool public capReached;
    uint256 public weiRaised;
    uint256 public tokensSold;

    /**
     * @dev Constructor.
     * @param _start The start time of the sale.
     * @param _end The end time of the sale.
     * @param _cap The maximum amount of tokens to be sold during the sale.
     * @param _wallet The address where funds should be transferred.
     * @param _kycSigners Array of the signers addresses required by the KYCBase constructor, provided by Eidoo.
     * See https://github.com/eidoo/icoengine
     */
    function CrowdsaleBase(
        uint256 _start,
        uint256 _end,
        uint256 _cap,
        address _wallet,
        address[] _kycSigners
    )
        public
        KYCBase(_kycSigners)
    {
        require(_end >= _start);
        require(_cap > 0);

        start = _start;
        end = _end;
        cap = _cap;
        wallet = _wallet;
        tokenPerEth = USD_PER_ETHER.div(USD_PER_TOKEN);
        availableTokens = _cap;
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return False if the ico is not started, true if the ico is started and running, true if the ico is completed.
     */
    function started() public view returns(bool) {
        if (block.timestamp >= start) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return False if the ico is not started, false if the ico is started and running, true if the ico is completed.
     */
    function ended() public view returns(bool) {
        if (block.timestamp >= end) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return Timestamp of the ico start time.
     */
    function startTime() public view returns(uint) {
        return start;
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return Timestamp of the ico end time.
     */
    function endTime() public view returns(uint) {
        return end;
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return The total number of the tokens available for the sale, must not change when the ico is started.
     */
    function totalTokens() public view returns(uint) {
        return cap;
    }

    /**
     * @dev Implements the ICOEngineInterface.
     * @return The number of the tokens available for the ico. At the moment the ico starts it must be equal to totalTokens(),
     * then it will decrease.
     */
    function remainingTokens() public view returns(uint) {
        return availableTokens;
    }

    /**
     * @dev Implements the KYCBase senderAllowedFor function to enable a sender to buy tokens for a different address.
     * @return true.
     */
    function senderAllowedFor(address buyer) internal view returns(bool) {
        require(buyer != address(0));

        return true;
    }

    /**
     * @dev Implements the KYCBase releaseTokensTo function to mint tokens for an investor. Called after the KYC process has passed.
     * @return A bollean that indicates if the operation was successful.
     */
    function releaseTokensTo(address buyer) internal returns(bool) {
        require(validPurchase());

        uint256 overflowTokens;
        uint256 refundWeiAmount;

        uint256 weiAmount = msg.value;
        uint256 tokenAmount = weiAmount.mul(price());

        if (tokenAmount >= availableTokens) {
            capReached = true;
            overflowTokens = tokenAmount.sub(availableTokens);
            tokenAmount = tokenAmount.sub(overflowTokens);
            refundWeiAmount = overflowTokens.div(price());
            weiAmount = weiAmount.sub(refundWeiAmount);
            buyer.transfer(refundWeiAmount);
        }

        weiRaised = weiRaised.add(weiAmount);
        tokensSold = tokensSold.add(tokenAmount);
        availableTokens = availableTokens.sub(tokenAmount);
        mintTokens(buyer, tokenAmount);
        forwardFunds(weiAmount);

        return true;
    }

    /**
     * @dev Fired by the releaseTokensTo function after minting tokens, to forward the raised wei to the address that collects funds.
     * @param _weiAmount Amount of wei send by the investor.
     */
    function forwardFunds(uint256 _weiAmount) internal {
        wallet.transfer(_weiAmount);
    }

    /**
     * @dev Validates an incoming purchase. Required statements revert state when conditions are not met.
     * @return true If the transaction can buy tokens.
     */
    function validPurchase() internal view returns (bool) {
        require(!paused && !capReached);
        require(block.timestamp >= start && block.timestamp <= end);

        return true;
    }

    /**
    * @dev Abstract function to mint tokens, to be implemented in the Crowdsale and Reservation contracts.
    * @param to The address that will receive the minted tokens.
    * @param amount The amount of tokens to mint.
    */
    function mintTokens(address to, uint256 amount) private;
}




