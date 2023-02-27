package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var cfgFile string

const CONFIG_REMOTE_SERVER string = "CONFIG_REMOTE_SERVER"

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "faas",
	Short: "Used to manage FaaS deployment",
	Long:  `Command line tool to interact with a FaaS deployment`,
	// Uncomment the following line if your bare application
	// has an action associated with it:
	// Run: func(cmd *cobra.Command, args []string) { },
}

// *** This command is used to deploy a function to the remote server *** //
var deployCmd = &cobra.Command{
	Use:   "deploy",
	Short: "Deploy a cloud function",
	Long:  `Used to deploy a cloud function--either to create or update it.`,
	Run: func(cmd *cobra.Command, args []string) {
		// Verify that a server has been set
		var serverUrl = viper.Get(CONFIG_REMOTE_SERVER)
		if serverUrl == nil {
			fmt.Println("You have not configured a remote server!\nPlease use faas config --server <IP>")
		} else {
			// Step 1: turn the working directory into a tarball

			// Step 2: Call the /deploy endpoint with the tarred directory

			// Step 3: Based on response from prev call, either notify of error or call the /build endpoint

			// Step 4: Update the user on the build progress
		}
	},
}

// *** This command is used to set config variables for the CLI to use *** //
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Configure FaaS settings",
	Long:  `Used to set configuration values for FaaS.`,
	Run: func(cmd *cobra.Command, args []string) {
		server, _ := cmd.Flags().GetString("server")
		if server != "" {
			viper.Set(CONFIG_REMOTE_SERVER, server)
			err := viper.WriteConfig()
			if err != nil {
				fmt.Println(err)
			} else {
				fmt.Println("Remote server set:", server)
			}
		} else {
			fmt.Println("")
		}
	},
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() {
	err := rootCmd.Execute()
	if err != nil {
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	// Here you will define your flags and configuration settings.
	// Cobra supports persistent flags, which, if defined here,
	// will be global for your application.

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.faascli.yaml)")

	// Cobra also supports local flags, which will only run
	// when this action is called directly.
	rootCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")

	configCmd.Flags().String("server", "s", "")

	rootCmd.AddCommand(deployCmd)
	rootCmd.AddCommand(configCmd)
}

// initConfig reads in config file and ENV variables if set.
func initConfig() {
	if cfgFile != "" {
		// Use config file from the flag.
		viper.SetConfigFile(cfgFile)
	} else {
		// Find home directory.
		home, err := os.UserHomeDir()
		cobra.CheckErr(err)

		// Search config in home directory with name ".faascli" (without extension).
		viper.AddConfigPath(home)
		viper.SetConfigType("yaml")
		viper.SetConfigName(".faascli")
		viper.SafeWriteConfig()
	}

	viper.AutomaticEnv() // read in environment variables that match

	// If a config file is found, read it in.
	if err := viper.ReadInConfig(); err == nil {
		// fmt.Fprintln(os.Stderr, "Using config file:", viper.ConfigFileUsed())
	}
}
