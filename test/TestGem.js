const { expect } = require("chai");
const { ethers } = require("hardhat");
const { parseUnits } = ethers.utils;

describe("Test Gem", function () {
    let pancakeFactory, pancakeRouter, mon;

    beforeEach(async function () {
        [owner, other, third, dev, ...accounts] = await ethers.getSigners();

        PancakePairStub = await ethers.getContractFactory("PancakePairStub");
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
        gem = await Gem.deploy(parseUnits("1", 9));
        mon = await PocMon.deploy(
            pancakeRouter.address,
            gem.address,
            dev.address,
            owner.address
        );

        await gem.setCompensator(mon.address);
        pair = await PancakePairStub.attach(await mon.uniswapV2Pair());
        await pair.setReserves(100, 1);

        await owner.sendTransaction({
            to: pancakeRouter.address,
            value: parseUnits("10"),
        });
    });

    it("Decimals are correct", async function () {
        expect(await gem.decimals()).to.equal(9);
    });

    it("Owner and only owner can set compensation rate", async function () {
        await expect(
            gem.connect(other).setCompensationRate(10)
        ).to.be.revertedWith("Ownable: caller is not the owner");

        await gem.setCompensationRate(10);
        expect(await gem.compensationRate()).to.equal(10);
    });

    it("Compensating from non-compensator does not mint", async function () {
        await gem.compensateBnb(other.address, parseUnits("1", 9));
        expect(await gem.balanceOf(other.address)).to.equal(0);
    });

    it("Compensating fee works correct", async function () {
        await mon.transfer(other.address, parseUnits("100000", 9));
        await mon
            .connect(other)
            .transfer(third.address, parseUnits("100000", 9));

        expect(await gem.balanceOf(other.address)).to.equal(
            parseUnits("100", 9)
        );
    });
});
