// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PongWarsBetting {
    address public owner;
    uint256 public constant PLATFORM_FEE_PERCENT = 30;
    
    enum GameState { WaitingForPlayers, GameActive, GameEnded }
    enum Winner { None, Day, Night, Tie }
    
    struct Game {
        address dayPlayer;
        address nightPlayer;
        uint256 dayBet;
        uint256 nightBet;
        GameState state;
        Winner winner;
        uint256 gameId;
        bool fundsDistributed;
        uint256 endTime;
    }
    
    mapping(uint256 => Game) public games;
    uint256 public nextGameId = 1;
    
    event GameCreated(uint256 indexed gameId, address indexed dayPlayer, uint256 dayBet);
    event PlayerJoined(uint256 indexed gameId, address indexed nightPlayer, uint256 nightBet);
    event GameStarted(uint256 indexed gameId);
    event GameEnded(uint256 indexed gameId, Winner winner);
    event FundsDistributed(uint256 indexed gameId, address indexed winner, uint256 amount, uint256 platformFee);
    event WinningsClaimed(uint256 indexed gameId, address indexed claimer, Winner winner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }
    
    modifier gameExists(uint256 gameId) {
        require(gameId < nextGameId && gameId > 0, "Game does not exist");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    // Day player creates a game and places bet
    function createGame() external payable returns (uint256) {
        require(msg.value > 0, "Bet must be greater than 0");
        
        uint256 gameId = nextGameId++;
        
        games[gameId] = Game({
            dayPlayer: msg.sender,
            nightPlayer: address(0),
            dayBet: msg.value,
            nightBet: 0,
            state: GameState.WaitingForPlayers,
            winner: Winner.None,
            gameId: gameId,
            fundsDistributed: false,
            endTime: 0
        });
        
        emit GameCreated(gameId, msg.sender, msg.value);
        return gameId;
    }
    
    // Night player joins the game and places bet
    function joinGame(uint256 gameId) external payable gameExists(gameId) {
        Game storage game = games[gameId];
        
        require(game.state == GameState.WaitingForPlayers, "Game not available");
        require(game.nightPlayer == address(0), "Game already full");
        require(msg.sender != game.dayPlayer, "Cannot play against yourself");
        require(msg.value > 0, "Bet must be greater than 0");
        
        game.nightPlayer = msg.sender;
        game.nightBet = msg.value;
        game.state = GameState.GameActive;
        
        emit PlayerJoined(gameId, msg.sender, msg.value);
        emit GameStarted(gameId);
    }
    
    // NEW: Simple claim winnings function - winner claims after game ends
    function claimWinnings(uint256 gameId, Winner _winner) external gameExists(gameId) {
        Game storage game = games[gameId];
        
        require(game.state == GameState.GameActive, "Game not active");
        require(game.nightPlayer != address(0), "Game not full");
        require(!game.fundsDistributed, "Funds already distributed");
        require(msg.sender == game.dayPlayer || msg.sender == game.nightPlayer, "Not a player in this game");
        require(_winner != Winner.None, "Must specify a winner");
        
        // Set winner and end game
        game.winner = _winner;
        game.state = GameState.GameEnded;
        game.endTime = block.timestamp;
        
        emit GameEnded(gameId, _winner);
        emit WinningsClaimed(gameId, msg.sender, _winner);
        
        // Distribute funds immediately
        _distributeFunds(gameId);
    }
    
    // Owner announces the winner and distributes funds (backup method)
    function announceWinner(uint256 gameId, Winner _winner) external onlyOwner gameExists(gameId) {
        Game storage game = games[gameId];
        
        require(game.state == GameState.GameActive, "Game not active");
        require(game.nightPlayer != address(0), "Game not full");
        require(!game.fundsDistributed, "Funds already distributed");
        
        game.winner = _winner;
        game.state = GameState.GameEnded;
        game.endTime = block.timestamp;
        
        emit GameEnded(gameId, _winner);
        
        // Distribute funds immediately
        _distributeFunds(gameId);
    }
    
    // Internal function to distribute funds
    function _distributeFunds(uint256 gameId) internal {
        Game storage game = games[gameId];
        
        require(!game.fundsDistributed, "Funds already distributed");
        
        uint256 totalPot = game.dayBet + game.nightBet;
        uint256 platformFee = (totalPot * PLATFORM_FEE_PERCENT) / 100;
        uint256 winnerAmount = totalPot - platformFee;
        
        game.fundsDistributed = true;
        
        if (game.winner == Winner.Day) {
            // Day player wins
            payable(game.dayPlayer).transfer(winnerAmount);
            emit FundsDistributed(gameId, game.dayPlayer, winnerAmount, platformFee);
        } else if (game.winner == Winner.Night) {
            // Night player wins
            payable(game.nightPlayer).transfer(winnerAmount);
            emit FundsDistributed(gameId, game.nightPlayer, winnerAmount, platformFee);
        } else if (game.winner == Winner.Tie) {
            // Tie - return original bets minus platform fee proportionally
            uint256 dayReturn = game.dayBet - (game.dayBet * PLATFORM_FEE_PERCENT) / 100;
            uint256 nightReturn = game.nightBet - (game.nightBet * PLATFORM_FEE_PERCENT) / 100;
            
            payable(game.dayPlayer).transfer(dayReturn);
            payable(game.nightPlayer).transfer(nightReturn);
            
            emit FundsDistributed(gameId, address(0), 0, platformFee);
        }
        
        // Platform fee stays in contract for owner to withdraw
    }
    
    // Day player can cancel game if no night player joined yet
    function cancelGame(uint256 gameId) external gameExists(gameId) {
        Game storage game = games[gameId];
        
        require(msg.sender == game.dayPlayer, "Only day player can cancel");
        require(game.state == GameState.WaitingForPlayers, "Cannot cancel active game");
        require(game.nightPlayer == address(0), "Cannot cancel, night player already joined");
        
        // Return bet to day player
        payable(game.dayPlayer).transfer(game.dayBet);
        
        // Mark game as ended
        game.state = GameState.GameEnded;
        game.fundsDistributed = true;
    }
    
    // Owner withdraws platform fees
    function withdrawPlatformFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        payable(owner).transfer(balance);
    }
    
    // View functions
    function getGame(uint256 gameId) external view gameExists(gameId) returns (Game memory) {
        return games[gameId];
    }
    
    function getActiveGames() external view returns (uint256[] memory) {
        uint256[] memory activeGames = new uint256[](nextGameId - 1);
        uint256 count = 0;
        
        for (uint256 i = 1; i < nextGameId; i++) {
            if (games[i].state == GameState.WaitingForPlayers || games[i].state == GameState.GameActive) {
                activeGames[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeGames[i];
        }
        
        return result;
    }
    
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // Emergency function to change owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
}
