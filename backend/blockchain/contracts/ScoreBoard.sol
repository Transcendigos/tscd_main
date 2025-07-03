// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ScoreBoard {
    event MatchPosted(
        uint256 indexed tournamentId,
        uint256 indexed matchId,
        address indexed winner,
        address player1,
        address player2,
        uint256 player1Score,
        uint256 player2Score,
        uint256 timestamp
    );

    struct Match {
        uint256 tournamentId;
        uint256 matchId;
        address player1;
        address player2;
        uint256 player1Score;
        uint256 player2Score;
        address winner;
        uint256 timestamp;
    }

    Match[] public matches;

    function postMatchResult(
        uint256 tournamentId,
        uint256 matchId,
        address player1,
        address player2,
        uint256 player1Score,
        uint256 player2Score,
        address winner
    ) external {
        Match memory m = Match({
            tournamentId: tournamentId,
            matchId: matchId,
            player1: player1,
            player2: player2,
            player1Score: player1Score,
            player2Score: player2Score,
            winner: winner,
            timestamp: block.timestamp
        });
        matches.push(m);
        emit MatchPosted(
            tournamentId,
            matchId,
            winner,
            player1,
            player2,
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