/**
 * @title PresaleTokenVault
 * @dev A token holder contract that allows multiple beneficiaries to extract their tokens after a given release time.
 *
 * @version 1.0
 * @author Validity Labs AG <info@validitylabs.org>
 */
pragma solidity ^0.4.17;

import "../../../node_modules/zeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";
import "../../../node_modules/zeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "../../../node_modules/zeppelin-solidity/contracts/math/SafeMath.sol";

import "../ico/UacCrowdsale.sol";

contract PresaleTokenVault {
    using SafeMath for uint256;
    using SafeERC20 for ERC20Basic;

    /*** CONSTANTS ***/
    uint256 public constant VESTING_OFFSET = 90 days;                   // starting of vesting
    uint256 public constant VESTING_DURATION = 180 days;                // duration of vesting

    uint256 public start;
    uint256 public cliff;
    uint256 public end;

    ERC20Basic public token;

    struct Investment {
        address beneficiary;
        uint256 totalBalance;
        uint256 released;
    }

    Investment[] public investments;

    // key: investor address; value: index in investments array.
    mapping(address => uint256) public investorLUT;

    /**
     * @dev Constructor.
     * @param beneficiaries Array of addresses of the beneficiaries to whom vested tokens are transferred.
     * @param balances Array of token amounts to be transferred per beneficiary.
     * @param startTime Start time from which the cliff will be calculated. This is seven days after ICO's end time.
     * @param _token The UAC Token, which is being vested.
     */
    function PresaleTokenVault(address[] beneficiaries, uint256[] balances, uint256 startTime, address _token) public {
        require(beneficiaries.length == balances.length);

        start = startTime;
        cliff = start.add(VESTING_OFFSET);
        end = cliff.add(VESTING_DURATION);

        token = ERC20Basic(_token);

        for (uint256 i = 0; i < beneficiaries.length; i = i.add(1)) {
            investorLUT[beneficiaries[i]] = investments.length;
            investments.push(Investment(beneficiaries[i], balances[i], 0));
        }
    }

    /**
     * @dev Allows a sender to transfer vested tokens to the beneficiary's address.
     * @param beneficiary The address that will receive the vested tokens.
     */
    function release(address beneficiary) public {
        uint256 unreleased = releasableAmount(beneficiary);
        require(unreleased > 0);

        uint256 investmentIndex = investorLUT[beneficiary];
        investments[investmentIndex].released = investments[investmentIndex].released.add(unreleased);
        token.safeTransfer(beneficiary, unreleased);
    }

    /**
     * @dev Transfers vested tokens to the sender's address.
     */
    function release() public {
        release(msg.sender);
    }

    /**
     * @dev Calculates the amount that has already vested but hasn't been released yet.
     * @param beneficiary The address that will receive the vested tokens.
     */
    function releasableAmount(address beneficiary) public view returns (uint256) {
        uint256 investmentIndex = investorLUT[beneficiary];

        return vestedAmount(beneficiary).sub(investments[investmentIndex].released);
    }

    /**
     * @dev Calculates the amount that has already vested.
     * @param beneficiary The address that will receive the vested tokens.
     */
    function vestedAmount(address beneficiary) public view returns (uint256) {

        uint256 investmentIndex = investorLUT[beneficiary];

        uint256 vested = 0;

        if (block.timestamp >= start) {
            // after start -> 1/3 released (fixed)
            vested = investments[investmentIndex].totalBalance.div(3);
        }
        if (block.timestamp >= cliff && block.timestamp < end) {
            // after cliff -> linear vesting over time
            uint256 p1 = investments[investmentIndex].totalBalance.div(3);
            uint256 p2 = investments[investmentIndex].totalBalance;

            /*
              released amount:  r
              1/3:              p1
              all:              p2
              current time:     t
              cliff:            c
              end:              e

              r = p1 +  / d_time * time
                = p1 + (p2-p1) / (e-c) * (t-c)
            */
            uint256 d_token = p2.sub(p1);
            uint256 time = block.timestamp.sub(cliff);
            uint256 d_time = end.sub(cliff);

            vested = vested.add(d_token.mul(time).div(d_time));
        }
        if (block.timestamp >= end) {
            // after end -> all vested
            vested = investments[investmentIndex].totalBalance;
        }
        return vested;
    }
}
