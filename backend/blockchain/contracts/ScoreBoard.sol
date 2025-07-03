// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ScoreBoard {
    event MatchPosted(
        uint256 tournamentId,
        uint256 matchId,
        uint256 winnerId,
        uint256 player1Id,
        uint256 player2Id,
        uint256 player1Score,
        uint256 player2Score,
        uint256 timestamp
    );

    struct Match {
        uint256 tournamentId;
        uint256 matchId;
        uint256 player1Id;
        uint256 player2Id;
        uint256 player1Score;
        uint256 player2Score;
        uint256 winnerId;
        uint256 timestamp;
    }

    Match[] public matches;

    function postMatchResult(
        uint256 tournamentId,
        uint256 matchId,
        uint256 player1Id,
        uint256 player2Id,
        uint256 player1Score,
        uint256 player2Score,
        uint256 winnerId
    ) external {
        Match memory m = Match({
            tournamentId: tournamentId,
            matchId: matchId,
            player1Id: player1Id,
            player2Id: player2Id,
            player1Score: player1Score,
            player2Score: player2Score,
            winnerId: winnerId,
            timestamp: block.timestamp
        });
        matches.push(m);
        emit MatchPosted(
            tournamentId,
            matchId,
            winnerId,
            player1Id,
            player2Id,
            player1Score,
            player2Score,
            block.timestamp
        );
    }

    function getMatch(uint256 idx) external view returns (Match memory) {
        return matches[idx];
    }

    function getMatchCount() external view returns (uint256) {
        return matches.length;
    }
}