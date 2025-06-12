// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ScoreBoard {
    event ScorePosted(address indexed user, uint256 tournamentId, uint256 score);

    struct Score {
        uint256 tournamentId;
        uint256 score;
    }

    mapping(address => Score[]) public userScores;

    function postScore(uint256 tournamentId, uint256 score) external {
        userScores[msg.sender].push(Score(tournamentId, score));
        emit ScorePosted(msg.sender, tournamentId, score);
    }

    function getScores(address user) external view returns (Score[] memory) {
        return userScores[user];
    }
}