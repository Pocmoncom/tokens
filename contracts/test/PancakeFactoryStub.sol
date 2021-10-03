//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "./PancakePairStub.sol";


contract PancakeFactoryStub {

    constructor() {}

    function createPair(address token0, address token1) external returns (address pair) {
        return address(new PancakePairStub(token0, token1));
    }
}