/**
 * @title Ubiatar Coin token
 *
 * @version 1.0
 * @author Validity Labs AG <info@validitylabs.org>
 */
pragma solidity ^0.4.19;

import "../../../node_modules/zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "../../../node_modules/zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
import "../../../node_modules/zeppelin-solidity/contracts/ownership/CanReclaimToken.sol";

contract UacToken is CanReclaimToken, MintableToken, PausableToken {
    string public constant name = "Ubiatar Coin";
    string public constant symbol = "UAC";
    uint8 public constant decimals = 18;

    /**
     * @dev Constructor of UacToken that instantiates a new Mintable Pausable Token
     */
    function UacToken() public {
        // token should not be transferrable until after all tokens have been issued
        paused = true;
    }
}
