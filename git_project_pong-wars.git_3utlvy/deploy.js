import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

async function deployContract() {
  try {
    console.log('🚀 Deploying PongWarsBetting contract to Sepolia...');
    
    // Hardcoded configuration
    const PRIVATE_KEY = 'b6b63ec4dcfc4de6c4788b0143dc8c2d5bb7943fc2843326b2dc9d81f8d9c4ec';
    const RPC = 'https://eth-sepolia.g.alchemy.com/v2/jom_1nyUaRm9YLQkgS-g9ZHrTE9L9nH_';
    
    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log(`📝 Deploying from address: ${wallet.address}`);
    
    // Check balance
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance === 0n) {
      throw new Error('Insufficient balance for deployment');
    }
    
    // Load compiled contract
    const buildDir = path.join(process.cwd(), 'build');
    
    if (!fs.existsSync(path.join(buildDir, 'PongWarsBetting.abi.json'))) {
      throw new Error('Contract not compiled. Run npm run compile first.');
    }
    
    const abi = JSON.parse(fs.readFileSync(path.join(buildDir, 'PongWarsBetting.abi.json'), 'utf8'));
    const { bytecode } = JSON.parse(fs.readFileSync(path.join(buildDir, 'PongWarsBetting.bytecode.json'), 'utf8'));
    
    // Create contract factory
    const contractFactory = new ethers.ContractFactory(abi, bytecode, wallet);
    
    // Deploy contract
    console.log('📤 Sending deployment transaction...');
    const contract = await contractFactory.deploy({
      gasLimit: 2000000, // Set gas limit
    });
    
    console.log(`⏳ Transaction hash: ${contract.deploymentTransaction().hash}`);
    console.log('⏳ Waiting for deployment confirmation...');
    
    // Wait for deployment
    await contract.waitForDeployment();
    const contractAddress = await contract.getAddress();
    
    console.log('✅ Contract deployed successfully!');
    console.log(`📍 Contract address: ${contractAddress}`);
    
    // Save deployment info
    const deploymentInfo = {
      contractAddress,
      network: 'sepolia',
      deployedAt: new Date().toISOString(),
      deployer: wallet.address,
      transactionHash: contract.deploymentTransaction().hash,
      abi: abi
    };
    
    fs.writeFileSync(
      path.join(process.cwd(), 'deployment-info.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );
    
    console.log('📁 Deployment info saved to: deployment-info.json');
    
    // Test contract by calling a view function
    console.log('🧪 Testing contract...');
    const owner = await contract.owner();
    const nextGameId = await contract.nextGameId();
    
    console.log(`👤 Contract owner: ${owner}`);
    console.log(`🎮 Next game ID: ${nextGameId}`);
    
    console.log('\n🎉 Deployment completed successfully!');
    console.log('\n📋 Contract Functions:');
    console.log('• createGame() - Day player creates game with ETH bet');
    console.log('• joinGame(gameId) - Night player joins with ETH bet');
    console.log('• announceWinner(gameId, winner) - Owner announces winner');
    console.log('• cancelGame(gameId) - Day player cancels if no opponent');
    console.log('• withdrawPlatformFees() - Owner withdraws 30% fees');
    
    return deploymentInfo;
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.log('💡 Make sure your wallet has enough Sepolia ETH for deployment');
    }
    
    process.exit(1);
  }
}

// Run deployment
deployContract();
