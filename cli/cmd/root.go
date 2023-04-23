package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var cfgFile string

const CONFIG_REMOTE_SERVER string = "CONFIG_REMOTE_SERVER"
const CONFIG_ACCESS_TOKEN string = "CONFIG_ACCESS_TOKEN"

// Types
type DEPLOY_RESPONSE struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
}

type LOGIN_RESPONSE struct {
	Success     bool   `json:"success"`
	Error       string `json:"error"`
	AccessToken string `json:"accessToken"`
}

// Helper functions
func check(e error) {
	if e != nil {
		panic(e)
	}
}

func parseJson(body io.ReadCloser, target interface{}) error {
	return json.NewDecoder(body).Decode(target)
}

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "faas",
	Short: "Used to manage FaaS deployment",
	Long:  `Command line tool to interact with a FaaS deployment`,
	// Uncomment the following line if your bare application
	// has an action associated with it:
	// Run: func(cmd *cobra.Command, args []string) { },
}

// *** This command is to log in as an admin *** //
var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Used to log admin in",
	Run: func(cmd *cobra.Command, args []string) {
		if !cmd.Flags().Lookup("u").Changed || !cmd.Flags().Lookup("p").Changed {
			fmt.Println("Missing a required field!\nPlease use faas login --u <user> --p <password> to log in.")
			return
		}
		// Verify that a server has been set
		serverUrl := viper.Get(CONFIG_REMOTE_SERVER)
		if serverUrl == nil {
			fmt.Println("You have not configured a remote server!\nPlease use faas config --server <IP>")
			return
		}
		httpClient := http.Client{}
		loginUrl := serverUrl.(string) + "/api/auth/login"
		user, _ := cmd.Flags().GetString("u")
		pass, _ := cmd.Flags().GetString("p")

		loginBody := []byte(fmt.Sprintf(`{
			"username": "%s",
			"password": "%s"
		}`, user, pass))

		loginReq, err := http.NewRequest("POST", loginUrl, bytes.NewBuffer(loginBody))
		check(err)

		loginReq.Header.Add("Content-Type", "application/json")

		res, err := httpClient.Do(loginReq)
		check(err)

		defer res.Body.Close()

		loginRes := new(LOGIN_RESPONSE)
		parseJson(res.Body, loginRes)
		if loginRes.Error != "" || loginRes.AccessToken == "" {
			fmt.Println(loginRes.Error)
			return
		}

		viper.Set(CONFIG_ACCESS_TOKEN, loginRes.AccessToken)
		atErr := viper.WriteConfig()
		if atErr != nil {
			fmt.Println(atErr)
		} else {
			fmt.Println("Logged in!")
		}
	},
}

// *** This command is used to deploy a function to the remote server *** //
var deployCmd = &cobra.Command{
	Use:   "deploy",
	Short: "Deploy a cloud function",
	Long:  `Used to deploy a cloud function--either to create or update it.`,
	Run: func(cmd *cobra.Command, args []string) {
		// Verify that a build dir has been created
		homedir, err := os.UserHomeDir()
		check(err)

		builddir := homedir + "/.faascli/builds/"
		buildDirErr := os.MkdirAll(builddir, os.ModePerm)
		check(buildDirErr)

		// Verify that a server has been set
		serverUrl := viper.Get(CONFIG_REMOTE_SERVER)
		// Verify that user has an access token
		accessToken := viper.Get(CONFIG_ACCESS_TOKEN)
		// Verify that an env has been passed
		if serverUrl == nil {
			fmt.Println("You have not configured a remote server!\nPlease use faas config --server <IP>")
		} else if accessToken == nil {
			fmt.Println("You have not logged in!\nPlease use faas login --u <username> --p <password>")
		} else if !cmd.Flags().Lookup("env").Changed {
			fmt.Println("Missing a target environment!\nPlease add the --env <envname> flag!")
		} else if !cmd.Flags().Lookup("name").Changed {
			fmt.Println("Missing a target function name!\nPlease add the --name <function name> flag!")
		} else if !cmd.Flags().Lookup("module").Changed {
			fmt.Println("Missing a module path!\nPlease add the --module <path> flag!")
		} else {
			fmt.Println("Starting function deploy...")

			env, _ := cmd.Flags().GetString("env")
			name, _ := cmd.Flags().GetString("name")
			module, _ := cmd.Flags().GetString("module")

			httpClient := http.Client{}

			tarballName := builddir + "build_" + strconv.FormatInt(time.Now().Unix(), 10) + ".tar"
			_, err := exec.Command("tar", "cf", tarballName, ".").Output()
			check(err)
			// Step 2: Call the /deploy endpoint with the tarred directory
			var (
				buf = new(bytes.Buffer)
				w   = multipart.NewWriter(buf)
			)

			// Pass file to request
			tarballFileContents, err := os.ReadFile(tarballName)
			check(err)

			part, err := w.CreateFormFile("deployment", tarballName)
			check(err)

			_, writeErr := part.Write(tarballFileContents)
			check(writeErr)

			w.WriteField("env", env)
			w.WriteField("functionName", name)
			w.WriteField("module", module)

			closeErr := w.Close()
			check(closeErr)

			// Fire deploy request
			deployUrl := serverUrl.(string) + "/api/cloudfunctions/deploy"
			deployReq, err := http.NewRequest("POST", deployUrl, buf)
			check(err)

			tokenString := "Bearer " + accessToken.(string)

			deployReq.Header.Add("Content-Type", w.FormDataContentType())
			deployReq.Header.Add("Authorization", tokenString)

			res, err := httpClient.Do(deployReq)
			check(err)
			defer res.Body.Close()

			deployRes := new(DEPLOY_RESPONSE)
			parseJson(res.Body, deployRes)
			buildErr := deployRes.Error
			buildSuccess := deployRes.Success
			if buildErr != "" {
				if buildErr != "" {
					fmt.Println(buildErr)
				}
				fmt.Println("An unknown error happened during deploy!")
				return
			}

			if buildSuccess {
				fmt.Println("Function '" + name + "' successfully deployed!")
				return
			}
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
			fmt.Println("Please enter a server URL with --server!")
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

	deployCmd.Flags().String("env", "e", "")
	deployCmd.Flags().String("name", "n", "")
	deployCmd.Flags().String("module", "m", "")

	loginCmd.Flags().String("u", "u", "")
	loginCmd.Flags().String("p", "p", "")

	rootCmd.AddCommand(deployCmd)
	rootCmd.AddCommand(configCmd)
	rootCmd.AddCommand(loginCmd)
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
