const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseUnits } = ethers.utils;

describe("Test PocMon", function () {
    let pancakeFactory, pancakeRouter, mon;

    beforeEach(async function () {
        [owner, other, third, dev, ...accounts] = await ethers.getSigners();

        PancakeFactoryStub = await ethers.getContractFactory(
            "PancakeFactoryStub"
        );
        PancakeRouterStub = await ethers.getContractFactory(
            "PancakeRouterStub"
        );
        PocMon = await ethers.getContractFactory("PocMon");
        Gem = await ethers.getContractFactory("Gem");

        pancakeFactory = await PancakeFactoryStub.deploy();
        pancakeRouter = await PancakeRouterStub.deploy(
            pancakeFactory.address,
            parseUnits("0.01")
        );
        gem = await Gem.deploy(parseUnits("1"));
        mon = await PocMon.deploy(
            pancakeRouter.address,
            gem.address,
            dev.address,
            owner.address
        );

        await gem.setCompensator(mon.address);

        await owner.sendTransaction({
            to: pancakeRouter.address,
            value: parseUnits("10"),
        });
    });

    it("Name, symbol and decimals are correct", async function () {
        expect(await mon.name()).to.equal("PocMon");
        expect(await mon.symbol()).to.equal("MON");
        expect(await mon.decimals()).to.equal(9);
    });

    it("Total supply is correct", async function () {
        expect(await mon.totalSupply()).to.equal(parseUnits("300000000", 9));
    });

    it("Initially owner should have total supply", async function () {
        expect(await mon.balanceOf(owner.address)).to.equal(
            await mon.totalSupply()
        );
    });

    it("Reflection from token is correct", async function () {
        reflection = await mon.reflectionFromToken(
            parseUnits("300000000", 9),
            false
        );

        reflection = await mon.reflectionFromToken(
            parseUnits("300000000", 9),
            true
        );
    });

    it("Reflection from token fails on overflowing amount", async function () {
        await expect(
            mon.reflectionFromToken(parseUnits("301000000", 9), false)
        ).to.be.revertedWith("Amount must be less than supply");
    });

    it("Token from reflection fails on overflowing amount", async function () {
        await expect(
            mon.tokenFromReflection(ethers.constants.MaxUint256)
        ).to.be.revertedWith("Amount must be less than total reflections");
    });

    it("Correct fee on transfer", async function () {
        await mon.transfer(other.address, parseUnits("1000", 9));
        await mon.connect(other).transfer(third.address, parseUnits("1000", 9));
        expect(await mon.balanceOf(owner.address)).to.equal(
            parseUnits("299999000", 9).add(parseUnits("10", 9)).sub(33001)
        );
        expect(await mon.balanceOf(other.address)).to.equal(0);
        expect(await mon.balanceOf(third.address)).to.equal(
            parseUnits("900", 9).add(30000)
        );
        // No swaps as minimal swap amount hasn't been reached
        expect(await pancakeRouter.swapsCount()).to.equal(0);
        expect(await pancakeRouter.liquidityCount()).to.equal(0);
    });

    it("Correct reflection distribution", async function () {
        await mon.transfer(other.address, parseUnits("100000000", 9));
        await mon.transfer(third.address, parseUnits("100000000", 9));
        await mon.connect(other).transfer(third.address, parseUnits("100", 9));

        const totalReflected = parseUnits("1", 9);

        expect(await mon.balanceOf(owner.address)).to.equal(
            parseUnits("100000000", 9)
                .add(
                    totalReflected
                        .mul(parseUnits("100000000", 9))
                        .div(parseUnits("300000000", 9))
                )
                .add(1)
        );
        expect(await mon.balanceOf(other.address)).to.equal(
            parseUnits("100000000", 9)
                .sub(parseUnits("100", 9))
                .add(
                    totalReflected
                        .mul(
                            parseUnits("100000000", 9).sub(parseUnits("100", 9))
                        )
                        .div(parseUnits("300000000", 9))
                )
                .add(1)
        );
        expect(await mon.balanceOf(third.address)).to.equal(
            parseUnits("100000000", 9)
                .add(parseUnits("90", 9))
                .add(
                    totalReflected
                        .mul(
                            parseUnits("100000000", 9).add(parseUnits("90", 9))
                        )
                        .div(parseUnits("300000000", 9))
                )
                .add(1)
        );
    });

    it("Can decrease allowance", async function () {
        await mon.approve(other.address, parseUnits("1000"));

        await mon.decreaseAllowance(other.address, parseUnits("100"));
        expect(await mon.allowance(owner.address, other.address)).to.equal(
            parseUnits("900")
        );
    });

    it("Can increase allowance", async function () {
        await mon.approve(other.address, parseUnits("1000"));

        await mon.increaseAllowance(other.address, parseUnits("100"));
        expect(await mon.allowance(owner.address, other.address)).to.equal(
            parseUnits("1100")
        );
    });

    it("After sufficient amount is collected swap-and-liquify occures", async function () {
        await mon.transfer(other.address, parseUnits("200000000", 9));

        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));
        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));

        const devBalanceBefore = await dev.getBalance();

        await mon.connect(other).transfer(third.address, 1);

        const totalSwappedBalance = parseUnits("1500000", 9);
        const totalFeeForDev = totalSwappedBalance.mul(6).div(9);
        const bnbFeeForDev = totalFeeForDev.div(100);
        const devBalanceAfter = await dev.getBalance();
        expect(devBalanceAfter.sub(devBalanceBefore)).to.equal(bnbFeeForDev);

        expect(await pancakeRouter.liquidityCount()).to.equal(1);
    });

    it("Swap-and-liquify won't swap more than max tx", async function () {
        await mon.setNumTokensSellToAddToLiquidity(parseUnits("3000000", 9));
        await mon.transfer(other.address, parseUnits("200000000", 9));

        await mon.excludeFromReward(mon.address);

        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));
        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));
        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));
        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));
        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));

        await mon.setMaxTxAmount(parseUnits("1500000", 9));
        await mon.connect(other).transfer(third.address, 1);

        expect(await pancakeRouter.liquidityCount()).to.equal(1);
    });

    it("Owner and only owner can exclude from fee", async function () {
        await expect(
            mon.connect(other).excludeFromFee(other.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await mon.excludeFromFee(other.address);
        expect(await mon.isExcludedFromFee(other.address)).to.be.true;
    });

    it("Owner and only owner can exclude from reward", async function () {
        await expect(
            mon.connect(other).excludeFromReward(other.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await mon.excludeFromReward(other.address);
        expect(await mon.isExcludedFromReward(other.address)).to.be.true;
    });

    it("Owner and only owner can include back to reward", async function () {
        await mon.excludeFromReward(other.address);

        await expect(
            mon.connect(other).includeInReward(other.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await mon.includeInReward(other.address);
        expect(await mon.isExcludedFromReward(other.address)).to.be.false;
    });

    it("Owner and only owner can include back to fee", async function () {
        await mon.excludeFromFee(other.address);

        await expect(
            mon.connect(other).includeInFee(other.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await mon.includeInFee(other.address);
        expect(await mon.isExcludedFromFee(other.address)).to.be.false;
    });

    it("Excluded from rewards do not receive rewards", async function () {
        await mon.transfer(other.address, parseUnits("100000000", 9));
        await mon.transfer(third.address, parseUnits("100000000", 9));

        await mon.excludeFromReward(third.address);
        await mon
            .connect(other)
            .transfer(dev.address, parseUnits("1000000", 9));

        expect(await mon.balanceOf(third.address)).to.equal(
            parseUnits("100000000", 9)
        );
    });

    it("Transfer from excluded to excluded works correct", async function () {
        await mon.transfer(other.address, parseUnits("100000000", 9));
        await mon.transfer(third.address, parseUnits("100000000", 9));

        await mon.excludeFromReward(other.address);
        await mon.excludeFromReward(third.address);

        await mon
            .connect(other)
            .transfer(third.address, parseUnits("1000000", 9));

        expect(await mon.balanceOf(other.address)).to.equal(
            parseUnits("100000000", 9).sub(parseUnits("1000000", 9))
        );
        expect(await mon.balanceOf(third.address)).to.equal(
            parseUnits("100000000", 9).add(parseUnits("900000", 9))
        );
    });

    it("Transfer from excluded to not excluded works correct", async function () {
        await mon.transfer(other.address, parseUnits("100000000", 9));
        await mon.transfer(third.address, parseUnits("100000000", 9));

        await mon.excludeFromFee(other.address);
        await mon.excludeFromReward(other.address);

        await mon
            .connect(other)
            .transfer(third.address, parseUnits("1000000", 9));

        expect(await mon.balanceOf(other.address)).to.equal(
            parseUnits("100000000", 9).sub(parseUnits("1000000", 9))
        );
        expect(await mon.balanceOf(third.address)).to.equal(
            parseUnits("100000000", 9).add(parseUnits("1000000", 9))
        );
    });

    it("Transfer from not excluded to excluded works correct", async function () {
        await mon.transfer(other.address, parseUnits("100000000", 9));
        await mon.transfer(third.address, parseUnits("100000000", 9));

        await mon.excludeFromFee(other.address);
        await mon.excludeFromReward(third.address);

        await mon
            .connect(other)
            .transfer(third.address, parseUnits("1000000", 9));

        expect(await mon.balanceOf(other.address)).to.equal(
            parseUnits("100000000", 9).sub(parseUnits("1000000", 9))
        );
        expect(await mon.balanceOf(third.address)).to.equal(
            parseUnits("100000000", 9).add(parseUnits("1000000", 9))
        );
    });

    it("Owner and only owner can set dev wallet", async function () {
        await expect(
            mon.connect(other).setDevWallet(other.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await mon.setDevWallet(other.address);
        expect(await mon.devWallet()).to.equal(other.address);
    });

    it("Owner and only owner can set router address", async function () {
        router2 = await PancakeRouterStub.deploy(pancakeFactory.address, 1);

        await expect(
            mon.connect(other).setRouterAddress(router2.address)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await mon.setRouterAddress(router2.address);
        expect(await mon.uniswapV2Router()).to.equal(router2.address);
    });

    it("Setting broken router does not break token", async function () {
        BrokenRouter = await ethers.getContractFactory("BrokenRouter");
        brokenRouter = await BrokenRouter.deploy(false);

        await mon.setRouterAddress(brokenRouter.address);

        await mon.transfer(other.address, parseUnits("300000000", 9));

        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));
        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));
        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));
    });

    it("Setting broken router with fake pair does not break token", async function () {
        BrokenRouter = await ethers.getContractFactory("BrokenRouter");
        brokenRouter = await BrokenRouter.deploy(true);

        await mon.setRouterAddress(brokenRouter.address);

        await mon.transfer(other.address, parseUnits("300000000", 9));

        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));
        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));
        await mon
            .connect(other)
            .transfer(third.address, parseUnits("10000000", 9));
    });

    it("Owner and only owner can set num tokens to sell", async function () {
        await expect(
            mon.connect(other).setNumTokensSellToAddToLiquidity(100)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await mon.setNumTokensSellToAddToLiquidity(100);
        expect(await mon.numTokensSellToAddToLiquidity()).to.equal(100);
    });

    it("Owner and only owner can set reflection fee percent", async function () {
        await expect(
            mon.connect(other).setReflectionFeePercent(3)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(mon.setReflectionFeePercent(30)).to.be.revertedWith(
            "You have reached fee limit"
        );

        await mon.setReflectionFeePercent(3);
        expect(await mon.reflectionFee()).to.equal(3);
    });

    it("Owner and only owner can set liquidity fee percent", async function () {
        await expect(
            mon.connect(other).setLiquidityFeePercent(5)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(mon.setLiquidityFeePercent(30)).to.be.revertedWith(
            "You have reached fee limit"
        );

        await mon.setLiquidityFeePercent(5);
        expect(await mon.liquidityFee()).to.equal(5);
    });

    it("Owner and only owner can set dev fee percent", async function () {
        await expect(mon.connect(other).setDevFeePercent(5)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );

        await expect(mon.setDevFeePercent(30)).to.be.revertedWith(
            "You have reached fee limit"
        );

        await mon.setDevFeePercent(5);
        expect(await mon.devFee()).to.equal(5);
    });

    it("Owner and only owner can set max tx amount", async function () {
        await expect(
            mon.connect(other).setMaxTxAmount(parseUnits("10000000", 9))
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await expect(mon.setMaxTxAmount(1)).to.be.revertedWith(
            "maxTxAmount should be greater than 1500000e9"
        );

        await mon.setMaxTxAmount(parseUnits("10000000", 9));
        expect(await mon._maxTxAmount()).to.equal(parseUnits("10000000", 9));
    });

    it("Owner and only owner can set swap and liquify enabled", async function () {
        await expect(
            mon.connect(other).setSwapAndLiquifyEnabled(false)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await mon.setSwapAndLiquifyEnabled(false);
        expect(await mon.swapAndLiquifyEnabled()).to.be.false;
    });
});
