// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TournamentScore {
    struct Score {
        address player;
        uint256 tournamentId;
        uint256 score;
    }

    Score[] public scores;

    event ScoreAdded(address indexed player, uint256 tournamentId, uint256 score);

    function addScore(uint256 tournamentId, uint256 score) public {
        scores.push(Score(msg.sender, tournamentId, score));
        emit ScoreAdded(msg.sender, tournamentId, score);
    }

    function getScore(uint256 index) public view returns (address, uint256, uint256) {
        Score memory s = scores[index];
        return (s.player, s.tournamentId, s.score);
    }

    function getAllScores() public view returns (Score[] memory) {
        return scores;
    }
}