//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Gem is Ownable, ERC20 {
    address public compensator;

    uint256 public compensationRate;

    constructor(uint256 compensationRate_) ERC20("GEM", "GEM") Ownable() {
        compensationRate = compensationRate_;
    }

    function decimals() public pure override returns (uint8) {
        return 9;
    }

    function setCompensator(address compensator_) external onlyOwner {
        compensator = compensator_;
    }

    function setCompensationRate(uint256 compensationRate_) external onlyOwner {
        compensationRate = compensationRate_;
    }

    function compensateBnb(address to, uint256 bnbAmount) external {
        if (msg.sender == compensator) {
            _mint(to, bnbAmount * compensationRate / 10**9);
        }
    }
}