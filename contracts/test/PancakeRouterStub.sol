//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";


contract PancakeRouterStub {

    address _factory;

    uint public swapsCount;
    uint public liquidityCount;
    uint public exchangeRateToEth;

    constructor(address factory_, uint256 exchangeRateToEth_) {
        _factory = factory_;
        exchangeRateToEth = exchangeRateToEth_;
    }

    receive() external payable {}

    function factory() external view returns (address) {
        return _factory;
    }

    function WETH() external pure returns (address) {
        return address(0);
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint amountIn,
        uint,
        address[] calldata path,
        address,
        uint
    ) external {
        swapsCount += 1;

        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        payable(msg.sender).transfer(amountIn * exchangeRateToEth / 10**18);
    }

    function addLiquidityETH(
        address,
        uint,
        uint,
        uint,
        address,
        uint
    ) external payable returns (uint amountToken, uint amountETH, uint liquidity) {
        liquidityCount += 1;
        return (0, 0, 0);
    }
}