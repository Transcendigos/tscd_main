// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ScoreStorage {
    struct Score {
        address player;
        uint256 points;
        uint256 timestamp;
    }

    Score[] public scores;

    event ScoreSubmitted(address indexed player, uint256 points, uint256 timestamp);

    function submitScore(uint256 points) public {
        scores.push(Score(msg.sender, points, block.timestamp));
        emit ScoreSubmitted(msg.sender, points, block.timestamp);
    }

    function getScore(uint index) public view returns (address, uint256, uint256) {
        require(index < scores.length, "Invalid index");
        Score memory s = scores[index];
        return (s.player, s.points, s.timestamp);
    }

    function totalScores() public view returns (uint256) {
        return scores.length;
    }
}