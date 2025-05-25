import solc from 'solc';
import fs from 'fs';
import path from 'path';

async function compileContract() {
  try {
    console.log('🔨 Compiling PongWarsBetting contract...');
    
    // Read the contract source code
    const contractPath = path.join(process.cwd(), 'contracts', 'PongWarsBetting.sol');
    const source = fs.readFileSync(contractPath, 'utf8');
    
    // Prepare the input for the Solidity compiler
    const input = {
      language: 'Solidity',
      sources: {
        'PongWarsBetting.sol': {
          content: source,
        },
      },
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
        viaIR: true,
        outputSelection: {
          '*': {
            '*': ['*'],
          },
        },
      },
    };
    
    // Compile the contract
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    
    // Check for compilation errors
    if (output.errors) {
      const hasErrors = output.errors.some(error => error.severity === 'error');
      
      if (hasErrors) {
        console.error('❌ Compilation failed with errors:');
        output.errors.forEach(error => {
          if (error.severity === 'error') {
            console.error(`Error: ${error.message}`);
          }
        });
        process.exit(1);
      } else {
        console.log('⚠️  Compilation warnings:');
        output.errors.forEach(error => {
          console.log(`Warning: ${error.message}`);
        });
      }
    }
    
    // Extract the compiled contract
    const contract = output.contracts['PongWarsBetting.sol']['PongWarsBetting'];
    
    if (!contract) {
      throw new Error('Contract not found in compilation output');
    }
    
    // Create build directory if it doesn't exist
    const buildDir = path.join(process.cwd(), 'build');
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }
    
    // Save ABI
    const abi = contract.abi;
    fs.writeFileSync(
      path.join(buildDir, 'PongWarsBetting.abi.json'),
      JSON.stringify(abi, null, 2)
    );
    
    // Save Bytecode
    const bytecode = contract.evm.bytecode.object;
    fs.writeFileSync(
      path.join(buildDir, 'PongWarsBetting.bytecode.json'),
      JSON.stringify({ bytecode: `0x${bytecode}` }, null, 2)
    );
    
    console.log('✅ Contract compiled successfully!');
    console.log(`📁 ABI saved to: build/PongWarsBetting.abi.json`);
    console.log(`📁 Bytecode saved to: build/PongWarsBetting.bytecode.json`);
    console.log(`📊 Contract size: ${bytecode.length / 2} bytes`);
    
    return {
      abi,
      bytecode: `0x${bytecode}`,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Compilation failed:', error.message);
    process.exit(1);
  }
}

// Run compilation
compileContract();
