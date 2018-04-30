/**
 * @title UbiatarPlayVault
 * @dev A token holder contract that allows the release of tokens to the UbiatarPlay Wallet.
 *
 * @version 1.0
 * @author Validity Labs AG <info@validitylabs.org>
 */

pragma solidity ^0.4.19;

import "../../../node_modules/zeppelin-solidity/contracts/math/SafeMath.sol";
import "../../../node_modules/zeppelin-solidity/contracts/token/ERC20/SafeERC20.sol";

import "./UacCrowdsale.sol";
import "./UacToken.sol";

contract UbiatarPlayVault {
    using SafeMath for uint256;
    using SafeERC20 for UacToken;

    uint256[6] public vesting_offsets = [
        90 days,
        180 days,
        270 days,
        360 days,
        540 days,
        720 days
    ];

    uint256[6] public vesting_amounts = [
        2e6 * 1e18,
        4e6 * 1e18,
        6e6 * 1e18,
        8e6 * 1e18,
        10e6 * 1e18,
        20.5e6 * 1e18
    ];

    address public ubiatarPlayWallet;
    UacToken public token;
    uint256 public start;
    uint256 public released;

    /**
     * @dev Constructor.
     * @param _ubiatarPlayWallet The address that will receive the vested tokens.
     * @param _token The UAC Token, which is being vested.
     * @param _start The start time from which each release time will be calculated.
     */
    function UbiatarPlayVault(
        address _ubiatarPlayWallet,
        address _token,
        uint256 _start
    )
        public
    {
        ubiatarPlayWallet = _ubiatarPlayWallet;
        token = UacToken(_token);
        start = _start;
    }

    /**
     * @dev Transfers vested tokens to ubiatarPlayWallet.
     */
    function release() public {
        uint256 unreleased = releasableAmount();
        require(unreleased > 0);

        released = released.add(unreleased);

        token.safeTransfer(ubiatarPlayWallet, unreleased);
    }

    /**
     * @dev Calculates the amount that has already vested but hasn't been released yet.
     */
    function releasableAmount() public view returns (uint256) {
        return vestedAmount().sub(released);
    }

    /**
     * @dev Calculates the amount that has already vested.
     */
    function vestedAmount() public view returns (uint256) {
        uint256 vested = 0;

        for (uint256 i = 0; i < vesting_offsets.length; i = i.add(1)) {
            if (block.timestamp > start.add(vesting_offsets[i])) {
                vested = vested.add(vesting_amounts[i]);
            }
        }

        return vested;
    }
}


