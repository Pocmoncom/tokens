//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;


contract PancakePairStub {

    address public token0;
    address public token1;

    uint256 public reserve0;
    uint256 public reserve1;

    constructor(address token0_, address token1_) {
        token0 = token0_;
        token1 = token1_;
    }

    function setReserves(uint256 reserve0_, uint256 reserve1_) external {
        reserve0 = reserve0_;
        reserve1 = reserve1_;
    }

    function getReserves() external view returns (uint256, uint256, uint256) {
        return (reserve0, reserve1, 0);
    }
}