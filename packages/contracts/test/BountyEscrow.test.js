const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const DAY = 24 * 60 * 60;
const DISPUTE_WINDOW = 3 * DAY;
const FEE_BPS = 250n; // 2.5%
const MIN_REWARD = ethers.parseEther("0.001");

async function deployFixture() {
  const [owner, feeRecipient, arbiter, creator, hunter, other] =
    await ethers.getSigners();
  const Factory = await ethers.getContractFactory("BountyEscrow");
  const escrow = await Factory.deploy(
    owner.address,
    feeRecipient.address,
    arbiter.address,
    FEE_BPS,
    MIN_REWARD,
    DISPUTE_WINDOW
  );
  await escrow.waitForDeployment();
  return { escrow, owner, feeRecipient, arbiter, creator, hunter, other };
}

async function futureDeadline(daysAhead = 1) {
  return (await time.latest()) + daysAhead * DAY;
}

const META = ethers.keccak256(ethers.toUtf8Bytes("bounty-doc"));
const PROOF = ethers.keccak256(ethers.toUtf8Bytes("proof"));

describe("BountyEscrow", function () {
  let ctx;
  beforeEach(async function () {
    ctx = await deployFixture();
  });

  describe("deployment", function () {
    it("stores constructor config", async function () {
      const { escrow, owner, feeRecipient, arbiter } = ctx;
      expect(await escrow.owner()).to.equal(owner.address);
      expect(await escrow.feeRecipient()).to.equal(feeRecipient.address);
      expect(await escrow.arbiter()).to.equal(arbiter.address);
      expect(await escrow.feeBps()).to.equal(FEE_BPS);
      expect(await escrow.minReward()).to.equal(MIN_REWARD);
      expect(await escrow.disputeWindow()).to.equal(DISPUTE_WINDOW);
      expect(await escrow.nextBountyId()).to.equal(1n);
    });

    it("rejects a fee above the hard cap", async function () {
      const { owner, feeRecipient, arbiter } = ctx;
      const Factory = await ethers.getContractFactory("BountyEscrow");
      await expect(
        Factory.deploy(owner.address, feeRecipient.address, arbiter.address, 1001, 0, DISPUTE_WINDOW)
      ).to.be.revertedWithCustomError(Factory, "FeeTooHigh");
    });

    it("rejects zero fee recipient or arbiter", async function () {
      const { owner, feeRecipient, arbiter } = ctx;
      const Factory = await ethers.getContractFactory("BountyEscrow");
      await expect(
        Factory.deploy(owner.address, ethers.ZeroAddress, arbiter.address, 0, 0, DISPUTE_WINDOW)
      ).to.be.revertedWithCustomError(Factory, "ZeroAddress");
      await expect(
        Factory.deploy(owner.address, feeRecipient.address, ethers.ZeroAddress, 0, 0, DISPUTE_WINDOW)
      ).to.be.revertedWithCustomError(Factory, "ZeroAddress");
    });
  });

  describe("createBounty", function () {
    it("escrows the reward and emits an event", async function () {
      const { escrow, creator } = ctx;
      const reward = ethers.parseEther("1");
      const deadline = await futureDeadline();
      await expect(escrow.connect(creator).createBounty(deadline, META, { value: reward }))
        .to.emit(escrow, "BountyCreated")
        .withArgs(1n, creator.address, reward, deadline, META);

      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(reward);
      const b = await escrow.getBounty(1n);
      expect(b.creator).to.equal(creator.address);
      expect(b.reward).to.equal(reward);
      expect(b.status).to.equal(0); // Open
      expect(await escrow.nextBountyId()).to.equal(2n);
    });

    it("reverts when reward is below the minimum", async function () {
      const { escrow, creator } = ctx;
      await expect(
        escrow.connect(creator).createBounty(await futureDeadline(), META, {
          value: MIN_REWARD - 1n,
        })
      ).to.be.revertedWithCustomError(escrow, "RewardTooLow");
    });

    it("reverts when the deadline is not in the future", async function () {
      const { escrow, creator } = ctx;
      const now = await time.latest();
      await expect(
        escrow.connect(creator).createBounty(now, META, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(escrow, "DeadlineInPast");
    });

    it("reverts when the reward exceeds uint96 (no silent truncation)", async function () {
      const { escrow, creator } = ctx;
      await expect(
        escrow.connect(creator).createBounty(await futureDeadline(), META, {
          value: 2n ** 96n, // one above type(uint96).max
        })
      ).to.be.revertedWithCustomError(escrow, "RewardTooLarge");
    });

    it("assigns incrementing ids", async function () {
      const { escrow, creator } = ctx;
      const deadline = await futureDeadline();
      await escrow.connect(creator).createBounty(deadline, META, { value: MIN_REWARD });
      await escrow.connect(creator).createBounty(deadline, META, { value: MIN_REWARD });
      expect((await escrow.getBounty(1n)).creator).to.equal(creator.address);
      expect((await escrow.getBounty(2n)).creator).to.equal(creator.address);
      expect(await escrow.nextBountyId()).to.equal(3n);
    });
  });

  describe("submit", function () {
    let id, deadline;
    beforeEach(async function () {
      deadline = await futureDeadline();
      await ctx.escrow.connect(ctx.creator).createBounty(deadline, META, {
        value: ethers.parseEther("1"),
      });
      id = 1n;
    });

    it("records a submission and counts unique hunters", async function () {
      const { escrow, hunter } = ctx;
      await expect(escrow.connect(hunter).submit(id, PROOF))
        .to.emit(escrow, "SubmissionCreated")
        .withArgs(id, hunter.address, PROOF);
      expect(await escrow.hasSubmitted(id, hunter.address)).to.equal(true);
      expect((await escrow.getBounty(id)).submissionCount).to.equal(1);
    });

    it("does not double-count repeat submissions from the same hunter", async function () {
      const { escrow, hunter } = ctx;
      await escrow.connect(hunter).submit(id, PROOF);
      await escrow.connect(hunter).submit(id, PROOF);
      expect((await escrow.getBounty(id)).submissionCount).to.equal(1);
    });

    it("blocks the creator from submitting", async function () {
      const { escrow, creator } = ctx;
      await expect(escrow.connect(creator).submit(id, PROOF)).to.be.revertedWithCustomError(
        escrow,
        "SelfSubmission"
      );
    });

    it("rejects submissions after the deadline", async function () {
      const { escrow, hunter } = ctx;
      await time.increaseTo(deadline + 1);
      await expect(escrow.connect(hunter).submit(id, PROOF)).to.be.revertedWithCustomError(
        escrow,
        "DeadlinePassed"
      );
    });
  });

  describe("approve", function () {
    let id;
    const reward = ethers.parseEther("1");
    beforeEach(async function () {
      await ctx.escrow.connect(ctx.creator).createBounty(await futureDeadline(), META, {
        value: reward,
      });
      id = 1n;
      await ctx.escrow.connect(ctx.hunter).submit(id, PROOF);
    });

    it("pays the hunter minus fee and routes the fee", async function () {
      const { escrow, creator, hunter, feeRecipient } = ctx;
      const fee = (reward * FEE_BPS) / 10000n;
      const payout = reward - fee;

      await expect(escrow.connect(creator).approve(id, hunter.address))
        .to.emit(escrow, "BountyApproved")
        .withArgs(id, hunter.address, payout, fee);

      await expect(escrow.connect(creator).approve(id, hunter.address)).to.be.reverted; // already paid
      const b = await escrow.getBounty(id);
      expect(b.status).to.equal(1); // Paid
      expect(b.winner).to.equal(hunter.address);
    });

    it("transfers the correct balances", async function () {
      const { escrow, creator, hunter, feeRecipient } = ctx;
      const fee = (reward * FEE_BPS) / 10000n;
      const payout = reward - fee;
      await expect(
        escrow.connect(creator).approve(id, hunter.address)
      ).to.changeEtherBalances([hunter, feeRecipient], [payout, fee]);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0);
    });

    it("only the creator can approve", async function () {
      const { escrow, other, hunter } = ctx;
      await expect(
        escrow.connect(other).approve(id, hunter.address)
      ).to.be.revertedWithCustomError(escrow, "NotCreator");
    });

    it("cannot approve a non-submitter", async function () {
      const { escrow, creator, other } = ctx;
      await expect(
        escrow.connect(creator).approve(id, other.address)
      ).to.be.revertedWithCustomError(escrow, "WinnerNotSubmitter");
    });

    it("can approve even after the deadline (before reclaim)", async function () {
      const { escrow, creator, hunter } = ctx;
      const b = await escrow.getBounty(id);
      await time.increaseTo(Number(b.deadline) + 1);
      await expect(escrow.connect(creator).approve(id, hunter.address)).to.emit(
        escrow,
        "BountyApproved"
      );
    });
  });

  describe("cancel", function () {
    let id;
    beforeEach(async function () {
      await ctx.escrow.connect(ctx.creator).createBounty(await futureDeadline(), META, {
        value: ethers.parseEther("1"),
      });
      id = 1n;
    });

    it("refunds the creator when there are no submissions", async function () {
      const { escrow, creator } = ctx;
      await expect(escrow.connect(creator).cancel(id))
        .to.emit(escrow, "BountyCancelled")
        .withArgs(id);
      expect((await escrow.getBounty(id)).status).to.equal(2); // Cancelled
    });

    it("reverts once a submission exists", async function () {
      const { escrow, creator, hunter } = ctx;
      await escrow.connect(hunter).submit(id, PROOF);
      await expect(escrow.connect(creator).cancel(id)).to.be.revertedWithCustomError(
        escrow,
        "HasSubmissions"
      );
    });

    it("only the creator can cancel", async function () {
      const { escrow, other } = ctx;
      await expect(escrow.connect(other).cancel(id)).to.be.revertedWithCustomError(
        escrow,
        "NotCreator"
      );
    });
  });

  describe("reclaim", function () {
    let id, deadline;
    beforeEach(async function () {
      deadline = await futureDeadline();
      await ctx.escrow.connect(ctx.creator).createBounty(deadline, META, {
        value: ethers.parseEther("1"),
      });
      id = 1n;
    });

    it("refunds after deadline + dispute window", async function () {
      const { escrow, creator } = ctx;
      await time.increaseTo(deadline + DISPUTE_WINDOW + 1);
      await expect(escrow.connect(creator).reclaim(id))
        .to.emit(escrow, "BountyReclaimed")
        .withArgs(id, creator.address, ethers.parseEther("1"));
      expect((await escrow.getBounty(id)).status).to.equal(3); // Reclaimed
    });

    it("reverts while the dispute window is still open", async function () {
      const { escrow, creator } = ctx;
      await time.increaseTo(deadline + 1);
      await expect(escrow.connect(creator).reclaim(id)).to.be.revertedWithCustomError(
        escrow,
        "DisputeWindowOpen"
      );
    });

    it("cannot reclaim a disputed bounty", async function () {
      const { escrow, creator, hunter } = ctx;
      await escrow.connect(hunter).submit(id, PROOF);
      await time.increaseTo(deadline + 1);
      await escrow.connect(hunter).openDispute(id);
      await time.increaseTo(deadline + DISPUTE_WINDOW + 1);
      await expect(escrow.connect(creator).reclaim(id)).to.be.revertedWithCustomError(
        escrow,
        "WrongStatus"
      );
    });
  });

  describe("disputes", function () {
    let id, deadline;
    const reward = ethers.parseEther("1");
    beforeEach(async function () {
      deadline = await futureDeadline();
      await ctx.escrow.connect(ctx.creator).createBounty(deadline, META, { value: reward });
      id = 1n;
      await ctx.escrow.connect(ctx.hunter).submit(id, PROOF);
    });

    it("a submitter can open a dispute within the window", async function () {
      const { escrow, hunter } = ctx;
      await time.increaseTo(deadline + 1);
      await expect(escrow.connect(hunter).openDispute(id))
        .to.emit(escrow, "DisputeOpened")
        .withArgs(id, hunter.address);
      expect((await escrow.getBounty(id)).status).to.equal(4); // Disputed
    });

    it("cannot dispute before the deadline", async function () {
      const { escrow, hunter } = ctx;
      await expect(escrow.connect(hunter).openDispute(id)).to.be.revertedWithCustomError(
        escrow,
        "DeadlineNotPassed"
      );
    });

    it("cannot dispute after the window closes", async function () {
      const { escrow, hunter } = ctx;
      await time.increaseTo(deadline + DISPUTE_WINDOW + 1);
      await expect(escrow.connect(hunter).openDispute(id)).to.be.revertedWithCustomError(
        escrow,
        "DisputeWindowClosed"
      );
    });

    it("non-submitters cannot dispute", async function () {
      const { escrow, other } = ctx;
      await time.increaseTo(deadline + 1);
      await expect(escrow.connect(other).openDispute(id)).to.be.revertedWithCustomError(
        escrow,
        "NotASubmitter"
      );
    });

    it("arbiter resolves in favor of the hunter", async function () {
      const { escrow, arbiter, hunter, feeRecipient } = ctx;
      await time.increaseTo(deadline + 1);
      await escrow.connect(hunter).openDispute(id);
      const fee = (reward * FEE_BPS) / 10000n;
      const payout = reward - fee;
      await expect(
        escrow.connect(arbiter).resolveDispute(id, hunter.address)
      ).to.changeEtherBalances([hunter, feeRecipient], [payout, fee]);
      expect((await escrow.getBounty(id)).status).to.equal(1); // Paid
    });

    it("arbiter resolves in favor of the creator (refund)", async function () {
      const { escrow, arbiter, creator, hunter } = ctx;
      await time.increaseTo(deadline + 1);
      await escrow.connect(hunter).openDispute(id);
      await expect(
        escrow.connect(arbiter).resolveDispute(id, ethers.ZeroAddress)
      ).to.changeEtherBalances([creator], [reward]);
      expect((await escrow.getBounty(id)).status).to.equal(3); // Reclaimed
    });

    it("only the arbiter can resolve", async function () {
      const { escrow, owner, hunter } = ctx;
      await time.increaseTo(deadline + 1);
      await escrow.connect(hunter).openDispute(id);
      await expect(
        escrow.connect(owner).resolveDispute(id, hunter.address)
      ).to.be.revertedWithCustomError(escrow, "NotArbiter");
    });
  });

  describe("admin", function () {
    it("owner updates fee within the cap", async function () {
      const { escrow, owner, other } = ctx;
      await expect(escrow.connect(owner).setFee(500, other.address))
        .to.emit(escrow, "FeeUpdated")
        .withArgs(500, other.address);
      expect(await escrow.feeBps()).to.equal(500n);
    });

    it("owner cannot exceed the fee cap", async function () {
      const { escrow, owner, other } = ctx;
      await expect(
        escrow.connect(owner).setFee(1001, other.address)
      ).to.be.revertedWithCustomError(escrow, "FeeTooHigh");
    });

    it("non-owner cannot change admin config", async function () {
      const { escrow, other } = ctx;
      await expect(escrow.connect(other).setArbiter(other.address)).to.be.revertedWithCustomError(
        escrow,
        "OwnableUnauthorizedAccount"
      );
    });

    it("owner updates arbiter, min reward and dispute window", async function () {
      const { escrow, owner, other } = ctx;
      await escrow.connect(owner).setArbiter(other.address);
      await escrow.connect(owner).setMinReward(123);
      await escrow.connect(owner).setDisputeWindow(999);
      expect(await escrow.arbiter()).to.equal(other.address);
      expect(await escrow.minReward()).to.equal(123n);
      expect(await escrow.disputeWindow()).to.equal(999n);
    });
  });

  describe("term snapshots (config changes are never retroactive)", function () {
    let id, deadline;
    const reward = ethers.parseEther("1");
    beforeEach(async function () {
      deadline = await futureDeadline();
      await ctx.escrow.connect(ctx.creator).createBounty(deadline, META, { value: reward });
      id = 1n;
      await ctx.escrow.connect(ctx.hunter).submit(id, PROOF);
    });

    it("a fee raise does not change the payout of a live bounty", async function () {
      const { escrow, owner, creator, hunter, feeRecipient } = ctx;
      await escrow.connect(owner).setFee(1000, feeRecipient.address); // raise to the 10% cap
      const fee = (reward * FEE_BPS) / 10000n; // still the rate at creation
      const payout = reward - fee;
      await expect(
        escrow.connect(creator).approve(id, hunter.address)
      ).to.changeEtherBalances([hunter, feeRecipient], [payout, fee]);
    });

    it("a fee raise applies to bounties created afterwards", async function () {
      const { escrow, owner, creator, hunter, feeRecipient } = ctx;
      await escrow.connect(owner).setFee(1000, feeRecipient.address);
      await escrow.connect(creator).createBounty(await futureDeadline(), META, { value: reward });
      await escrow.connect(hunter).submit(2n, PROOF);
      const fee = (reward * 1000n) / 10000n;
      await expect(
        escrow.connect(creator).approve(2n, hunter.address)
      ).to.changeEtherBalances([hunter, feeRecipient], [reward - fee, fee]);
    });

    it("shrinking the dispute window cannot unlock an early reclaim", async function () {
      const { escrow, owner, creator } = ctx;
      await escrow.connect(owner).setDisputeWindow(0);
      await time.increaseTo(deadline + 1);
      // The bounty keeps its 3-day window; reclaim right after the deadline fails.
      await expect(escrow.connect(creator).reclaim(id)).to.be.revertedWithCustomError(
        escrow,
        "DisputeWindowOpen"
      );
    });

    it("hunters keep their original dispute window after a shrink", async function () {
      const { escrow, owner, hunter } = ctx;
      await escrow.connect(owner).setDisputeWindow(0);
      await time.increaseTo(deadline + DISPUTE_WINDOW - 60); // inside the original window
      await expect(escrow.connect(hunter).openDispute(id)).to.emit(escrow, "DisputeOpened");
    });

    it("fee recipient rotation applies immediately (operational, not a term)", async function () {
      const { escrow, owner, creator, hunter, other } = ctx;
      await escrow.connect(owner).setFee(FEE_BPS, other.address); // same rate, new wallet
      const fee = (reward * FEE_BPS) / 10000n;
      await expect(
        escrow.connect(creator).approve(id, hunter.address)
      ).to.changeEtherBalances([hunter, other], [reward - fee, fee]);
    });
  });

  describe("pull-payment fallback", function () {
    it("credits a reverting recipient and lets them withdraw", async function () {
      const { escrow, creator, owner, feeRecipient } = ctx;
      // Deploy a contract that rejects ETH to act as the fee recipient.
      const Rejecter = await ethers.getContractFactory("RejectEther");
      const rejecter = await Rejecter.deploy();
      await rejecter.waitForDeployment();
      await escrow.connect(owner).setFee(FEE_BPS, await rejecter.getAddress());

      const reward = ethers.parseEther("1");
      await escrow.connect(creator).createBounty(await futureDeadline(), META, { value: reward });
      const [, , , , hunter] = await ethers.getSigners();
      await escrow.connect(hunter).submit(1n, PROOF);
      await escrow.connect(creator).approve(1n, hunter.address);

      const fee = (reward * FEE_BPS) / 10000n;
      // Fee push failed -> credited for later withdrawal, escrow retains the fee.
      expect(await escrow.pendingWithdrawals(await rejecter.getAddress())).to.equal(fee);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(fee);
    });
  });
});
