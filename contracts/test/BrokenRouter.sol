//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

contract BrokenPair {
    constructor() {}
}

contract BrokenFactory {
    bool public useFakePair;

    constructor(bool useFakePair_) {
        useFakePair = useFakePair_;
    }

    function createPair(address, address) external returns (address) {
        if (useFakePair) {
            return address(0);
        } else {
            return address(new BrokenPair());
        }
    }
}

contract BrokenRouter {

    address public factory;

    constructor(bool useFakePair) {
        factory = address(new BrokenFactory(useFakePair));
    }

    function WETH() external pure returns (address) {
        return address(0);
    }
}