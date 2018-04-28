/**
 * @title CrowdsaleBase
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

    // ICOEngineInterface
    function started() public view returns(bool) {
        if (block.timestamp >= start) {
            return true;
        } else {
            return false;
        }
    }

    // ICOEngineInterface
    function ended() public view returns(bool) {
        if (block.timestamp >= end) {
            return true;
        } else {
            return false;
        }
    }

    // ICOEngineInterface
    function startTime() public view returns(uint) {
        return start;
    }

    // ICOEngineInterface
    function endTime() public view returns(uint) {
        return end;
    }

    // ICOEngineInterface
    function totalTokens() public view returns(uint) {
        return cap;
    }

    // ICOEngineInterface
    function remainingTokens() public view returns(uint) {
        return availableTokens;
    }

    // KYCBase
    function senderAllowedFor(address buyer) internal view returns(bool) {
        require(buyer != address(0));

        return true;
    }

    // KYCBase
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

    function forwardFunds(uint256 _weiAmount) internal {
        wallet.transfer(_weiAmount);
    }

    function validPurchase() internal view returns (bool) {
        require(!paused && !capReached);
        require(block.timestamp >= start && block.timestamp <= end);

        return true;
    }

    function mintTokens(address to, uint256 amount) private;
}




